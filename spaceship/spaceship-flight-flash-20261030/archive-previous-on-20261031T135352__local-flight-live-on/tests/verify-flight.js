import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';

async function runVerification() {
  console.log('--- Starting WebGL & Flight Verification ---');

  if (!existsSync('./screenshots')) {
    mkdirSync('./screenshots', { recursive: true });
  }

  // 1. Start Vite dev server
  const server = spawn('npx', ['vite', '--port', '5173', '--host', '127.0.0.1'], {
    stdio: 'pipe',
    shell: true,
  });

  let serverStarted = false;
  server.stdout.on('data', (data) => {
    const text = data.toString();
    if (text.includes('5173') || text.includes('Local:')) {
      serverStarted = true;
    }
  });

  // Wait for server to be up
  for (let i = 0; i < 30; i++) {
    if (serverStarted) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.error('Browser console error:', msg.text());
    }
  });

  page.on('pageerror', (err) => {
    errors.push(err.message);
    console.error('Page error:', err.message);
  });

  try {
    console.log('Navigating to http://127.0.0.1:5173...');
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });

    // Check canvas
    const canvas = await page.$('canvas');
    if (!canvas) throw new Error('Canvas element not found in DOM');

    // Wait a moment for initial render
    await page.waitForTimeout(1000);

    // Initial state checks
    const initialStatus = await page.$eval('#hud-status', (el) => el.textContent.trim());
    console.log(`Initial Status: "${initialStatus}"`);
    if (!initialStatus.includes('READY ON PAD')) {
      throw new Error(`Unexpected initial status: ${initialStatus}`);
    }

    const takeoffBtn = await page.$('#btn-takeoff');
    const isTakeoffDisabled = await takeoffBtn.isDisabled();
    if (isTakeoffDisabled) {
      throw new Error('Takeoff button should be enabled initially');
    }

    await page.screenshot({ path: './screenshots/01_ready_on_pad.png' });
    console.log('Screenshot saved: 01_ready_on_pad.png');

    // Test Camera Mode Switching
    console.log('Testing Camera Modes...');
    await page.click('#cam-pad');
    await page.waitForTimeout(300);
    let activeCam = await page.$eval('#cam-pad', (el) => el.classList.contains('active'));
    if (!activeCam) throw new Error('Pad Cam button not active');

    await page.click('#cam-free');
    await page.waitForTimeout(300);
    activeCam = await page.$eval('#cam-free', (el) => el.classList.contains('active'));
    if (!activeCam) throw new Error('Free Cam button not active');

    await page.click('#cam-cockpit');
    await page.waitForTimeout(300);
    activeCam = await page.$eval('#cam-cockpit', (el) => el.classList.contains('active'));
    if (!activeCam) throw new Error('Cockpit Cam button not active');

    await page.click('#cam-follow');
    await page.waitForTimeout(300);
    activeCam = await page.$eval('#cam-follow', (el) => el.classList.contains('active'));
    if (!activeCam) throw new Error('Follow Cam button not active');

    // Test Zoom controls and Reset
    await page.click('#btn-zoom-in');
    await page.waitForTimeout(100);
    await page.click('#btn-zoom-out');
    await page.waitForTimeout(100);
    await page.click('#btn-reset-cam');
    await page.waitForTimeout(100);

    // Test Sound Toggle
    await page.click('#btn-sound');
    const soundActive = await page.$eval('#btn-sound', (el) => el.classList.contains('active'));
    console.log(`Sound toggled: active = ${soundActive}`);

    // Test Speed selection (set to 2x for faster test flight)
    await page.click('button[data-speed="2.0"]');
    console.log('Set speed to 2.0x for circuit test');

    // Initiate Takeoff
    console.log('Clicking Initiate Takeoff...');
    await page.click('#btn-takeoff');

    // Wait for vertical climb
    await page.waitForTimeout(2000);
    const climbingStatus = await page.$eval('#hud-status', (el) => el.textContent.trim());
    const climbingAlt = await page.$eval('#hud-alt', (el) => el.textContent.trim());
    console.log(`Climb Status: "${climbingStatus}", Altitude: ${climbingAlt}`);
    await page.screenshot({ path: './screenshots/02_vertical_climb.png' });
    console.log('Screenshot saved: 02_vertical_climb.png');

    // Wait for circuit flight
    await page.waitForTimeout(3000);
    const circuitStatus = await page.$eval('#hud-status', (el) => el.textContent.trim());
    const circuitSpeed = await page.$eval('#hud-speed', (el) => el.textContent.trim());
    const circuitProgress = await page.$eval('#hud-progress-pct', (el) => el.textContent.trim());
    console.log(`Circuit Flight: Status "${circuitStatus}", Speed: ${circuitSpeed}, Progress: ${circuitProgress}`);
    await page.screenshot({ path: './screenshots/03_circuit_flight.png' });
    console.log('Screenshot saved: 03_circuit_flight.png');

    // Test Pause and Resume
    console.log('Testing Pause...');
    await page.click('#btn-pause');
    await page.waitForTimeout(500);
    const pauseStatus = await page.$eval('#hud-status', (el) => el.textContent.trim());
    if (!pauseStatus.includes('PAUSED')) {
      throw new Error(`Expected paused status, got ${pauseStatus}`);
    }
    console.log('Resume Flight...');
    await page.click('#btn-pause');
    await page.waitForTimeout(500);

    // Let flight complete circuit and land back on pad
    console.log('Waiting for flight circuit to finish and ship to land smoothly on pad...');

    // We can either wait for the full circuit (~11 seconds at 2x) or test Land Now
    let landed = false;
    for (let sec = 0; sec < 35; sec++) {
      await page.waitForTimeout(1000);
      const status = await page.$eval('#hud-status', (el) => el.textContent.trim());
      const alt = await page.$eval('#hud-alt', (el) => el.textContent.trim());
      const gear = await page.$eval('#hud-gear', (el) => el.textContent.trim());
      console.log(`[t=${sec}s] Status: ${status}, Alt: ${alt}, Gear: ${gear}`);

      if (status.includes('FINAL DESCENT')) {
        await page.screenshot({ path: './screenshots/04_approach_descent.png' });
      }

      if (status.includes('TOUCHDOWN') || status.includes('READY ON PAD')) {
        landed = true;
        await page.screenshot({ path: './screenshots/05_touchdown_pad.png' });
        console.log('Touchdown confirmed and screenshot captured!');
        break;
      }
    }

    if (!landed) {
      throw new Error('Ship did not complete landing circuit within expected timeout');
    }

    // Mobile Viewport Check
    console.log('Testing Mobile Viewport (375x667)...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: './screenshots/06_mobile_view.png' });
    console.log('Screenshot saved: 06_mobile_view.png');

    // Check for any console errors during the run
    if (errors.length > 0) {
      throw new Error(`Errors logged during run: ${errors.join('; ')}`);
    }

    console.log('✅ ALL VERIFICATION CHECKS PASSED PERFECTLY!');
  } finally {
    await browser.close();
    server.kill();
  }
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
