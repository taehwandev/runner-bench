export const CARS=9, PITCH=10, LENGTH=11+CARS*PITCH;
export const ENTRY=756, EXIT=972-LENGTH;
export const cuts=[0,10,18,24,34,40,46,53,60];
export const titles=['The northern line','Sleeper cars','The undercity','Vesper Station','Departure','The bore','Over the strait','Night crossing'];
export function motion(t){
  let distance,speed;
  if(t<24){speed=24;distance=24*t;}
  else if(t<30){const u=t-24;speed=24-4*u;distance=576+24*u-2*u*u;}
  else if(t<34){speed=0;distance=648;}
  else if(t<40){const u=t-34;speed=6*u;distance=648+3*u*u;}
  else {speed=36;distance=756+(t-40)*36;}
  return {distance,speed,cars:CARS,atStation:t>=30&&t<=34,inTunnel:distance>=ENTRY&&distance-LENGTH<EXIT};
}

