import { Storage, Context, generateEvent } from '@massalabs/massa-as-sdk';
import { Args, stringToBytes } from '@massalabs/as-types';

/**
 * Initializes the canvas with a default color for each pixel.
 * This function is called only once upon the deployment of the contract to prepare the canvas.
 *
 * @param _ - The arguments to the constructor, not used here.
 */
export function constructor(_: StaticArray<u8>): void {
  // This check is important. It ensures that this function can only be called at the time of deployment.
  if (!Context.isDeployingContract()) {
    return;
  }
  
  const defaultColor = "FFFFFF"; // Default color in hexadecimal (white, for example)
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      let key = `${x},${y}`;
      Storage.set(key, defaultColor);
    }
  }
}

/**
 * Retrieves the color of a pixel specified by its coordinates (x, y).
 *
 * @param _args - The serialized x and y coordinates of the pixel.
 * @returns The hexadecimal color of the pixel.
 */
export function getPixelColor(_args: StaticArray<u8>): StaticArray<u8> {
  let args = new Args(_args);
  
  // Extracting x and y coordinates from the serialized arguments
  let x = args.nextU32().expect('Missing x coordinate.');
  let y = args.nextU32().expect('Missing y coordinate.');
  
  let key = `${x},${y}`;
  
  // Checking for the existence of the color for the specified pixel
  if (!Storage.has(key)) {
    generateEvent("No color found for pixel at " + key);
    return stringToBytes("No color found");
  }
  
  // Retrieving the stored color
  let color = Storage.get(key);
  
  generateEvent("Color for pixel at " + key + " is " + color);
  // Returning the color as a serialized response
  return stringToBytes(color);
}
