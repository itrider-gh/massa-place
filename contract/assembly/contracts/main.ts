import {
  Context,
  generateEvent,
  remainingGas,
  transferredCoins,
  isAddressEoa,
  transferCoins,
  Address,
  createEvent,
} from '@massalabs/massa-as-sdk';
import { PersistentMap } from '../libraries/PersistentMap';
import { Args, stringToBytes } from '@massalabs/as-types';

const COLOR = new PersistentMap<string, string>('color');
const OWNER = new PersistentMap<string, string>('owner');
const PRICE = new PersistentMap<string, u64>('price');

// Constructor function for smart contract deployment
export function constructor(_: StaticArray<u8>): void {
  // Check if the contract is being deployed, if not, exit the function
  if (!Context.isDeployingContract()) {
    return;
  }

  // Default values for a pixel
  const defaultOwner = Context.caller().toString(); // Default owner before any purchase
  const defaultColor = 'FFFFFF'; // Default color for the pixels
  const initialPrice = u64(10 ** 8); // Initial price for each pixel, 0.1 Massa = 10_000_000

  assert(isAddressEoa(defaultOwner), 'Only EOA can deploy the contract');

  // Initialize 100x100 pixels with default values
  for (let x = 0; x < 100; x++) {
    for (let y = 0; y < 100; y++) {
      let key = `${x},${y}`; // Composite key for storage
      // Store the pixel data
      COLOR.set(key, defaultColor);
      OWNER.set(key, defaultOwner);
      PRICE.set(key, initialPrice);
    }
  }
}

/**
 * Changes the color of multiple pixels
 * @param _args Encoded arguments for the operation
 */
export function changeMultiplePixelsColor(_args: StaticArray<u8>): void {
  // Decode the arguments
  let args = new Args(_args);
  // use i32 instead of string
  let numberOfPixelsToChange = args
    .nextI32()
    .expect('Missing number of pixels to change.');
  let callerAddress = Context.caller().toString();

  // Iterate through each pixel to change its color
  for (let i = 0; i < numberOfPixelsToChange; i++) {
    let x = args.nextU32().expect('Missing x coordinate.');
    let y = args.nextU32().expect('Missing y coordinate.');
    let newColor = args.nextString().expect('Missing new color.');

    let key = `${x},${y}`;

    // Check if the pixel exists
    if (!COLOR.contains(key)) {
      generateEvent(`Massa Place colorChangeError Pixel at ${key} not found.`);
      continue;
    }

    // Only the current owner can change the pixel color
    let currentOwner = OWNER.getSome(key, '').unwrap();

    if (callerAddress !== currentOwner) {
      generateEvent(
        `Massa Place colorChangeError Unauthorized: Caller ${callerAddress} is not the owner of pixel at ${key}.`,
      );
      continue;
    }

    // Update the storage with the new color
    COLOR.set(key, newColor);
    generateEvent(createEvent("Massa Place", ["colorChange", `${key},${newColor}`]));
  }
}

// Modifies the function to change the price of multiple pixels
export function setMultiplePixelsPrice(_args: StaticArray<u8>): void {
  let args = new Args(_args);
  // Retrieve the number of pixels whose price will be changed
  let numberOfPixelsToChangePrice = args
    .nextI32()
    .expect('Missing number of pixels to change price');
  let callerAddress = Context.caller().toString();

  // Iterate through each pixel to update its price
  for (let i = 0; i < numberOfPixelsToChangePrice; i++) {
    let x = args.nextU32().expect('Missing x coordinate.'); // X coordinate
    let y = args.nextU32().expect('Missing y coordinate.'); // Y coordinate
    let newPrice = args.nextU64().expect('Missing new price.'); // New price for the pixel

    let key = `${x},${y}`; // Composite key based on coordinates

    // Verify pixel exists before attempting price update
    if (!COLOR.contains(key)) {
      generateEvent(`Massa Place changePriceError Pixel at ${key} not found.`);
      continue;
    }

    // Update price only if the caller is the current owner
    let currentOwner = OWNER.getSome(key, '').unwrap();

    if (callerAddress !== currentOwner) {
      generateEvent(
        `Massa Place changePriceError Unauthorized: Caller ${callerAddress} is not the owner of pixel at ${key}.`,
      );
      continue;
    }

    // Successfully update the pixel's price
    PRICE.set(key, newPrice);
    generateEvent(createEvent("Massa Place", ["changePrice",`${key},${newPrice}`]));
  }
}

// Function to handle the buying of pixels by users
export function buyPixels(_args: StaticArray<u8>): void {
  let args = new Args(_args);
  // Extract the number of pixels a user intends to buy from the arguments
  let numberOfPixelsToBuy = args
    .nextI32()
    .expect('Missing number of pixels to buy');

  // Retrieve the total amount of coins transferred with the transaction
  let totalTransferredAmount = transferredCoins(); // Ensure the correct conversion for your case
  let totalProposedPrice: u64 = 0; // Sum of proposed prices for all pixels intended for purchase
  let refundAmount: u64 = 0; // Tracks the total amount that needs to be refunded
  let buyerAddress = Context.caller().toString();

  assert(isAddressEoa(buyerAddress), 'Only EOA can buy pixels');

  // Process each pixel for purchase
  for (let i = 0; i < numberOfPixelsToBuy; i++) {
    let x = args.nextU32().expect('Missing x coordinate.');
    let y = args.nextU32().expect('Missing y coordinate.');
    let proposedPrice = args.nextU64().expect('Missing proposed price.');
    assert(
      totalProposedPrice + proposedPrice >= totalProposedPrice,
      'Math Overflow',
    );
    totalProposedPrice += proposedPrice;

    let key = `${x},${y}`;

    // Check if the specified pixel exists
    if (!COLOR.contains(key)) {
      generateEvent(`Massa Place buyPixel Pixel at ${key} not found.`);
      assert(refundAmount + proposedPrice >= refundAmount, 'Math Overflow');
      refundAmount += proposedPrice; // Add to the refund amount
      continue;
    }

    let price = PRICE.get(key, 0); // Retrieve the price of the pixel
    if (price === u64.MAX_VALUE || price !== proposedPrice) {
      generateEvent(
        `Massa Place buyPixel Pixel at ${key} cannot be bought for the proposed price: ${proposedPrice.toString()}.`,
      );
      assert(refundAmount + proposedPrice >= refundAmount, 'Math Overflow');
      refundAmount += proposedPrice; // Add to the refund amount
      continue;
    }

    let currentOwner = OWNER.getSome(key, '').unwrap(); // Retrieve the current owner of the pixel

    // Update the pixel data to reflect the new owner and mark it as not for sale
    OWNER.set(key, buyerAddress);
    PRICE.set(key, u64.MAX_VALUE);
    COLOR.set(key, '000000');

    transferCoins(new Address(currentOwner), price); // Transfer the coins to the current owner

    generateEvent(createEvent('Massa Place', ['buyPixel', `${key},${buyerAddress}`]));
  }

  assert(
    totalTransferredAmount >= totalProposedPrice,
    `Not enough coins transferred: required ${totalProposedPrice}, but got ${totalTransferredAmount}.`,
  );

  // Simulate a refund if necessary
  if (refundAmount > 0) {
    generateEvent(`test Refund needed: ${refundAmount.toString()}`);
    transferCoins(new Address(buyerAddress), refundAmount);
  }
}

// Function to retrieve details of all pixels within the smart contract's storage
export function getAllPixelsDetails(_args: StaticArray<u8>): StaticArray<u8> {
  // Initialize Args to parse the incoming arguments for starting coordinates
  let args = new Args(_args);
  // Extract the starting X and Y coordinates from the arguments
  let startX = args.nextU32().expect('Missing starting x coordinate.');
  let startY = args.nextU32().expect('Missing starting y coordinate.');
  // Initialize a string to accumulate pixel details
  let allPixelsDetails = '';
  const delimiter = '|'; // Delimiter to separate pixel details in the string
  // Define a margin for remaining gas to ensure the function doesn't run out of gas
  const SOME_MARGIN = u64(100_000_000); // To dertermine by test

  // Iterate over the pixel grid starting from the provided coordinates
  for (let x = startX; x < 100; x++) {
    for (let y = x === startX ? startY : 0; y < 100; y++) {
      // Check if the remaining gas is below the defined margin
      if (remainingGas() < SOME_MARGIN) {
        // If gas is running low, return the accumulated pixel details to prevent transaction failure
        generateEvent('Low gas - partial data sent');
        allPixelsDetails +=
          remainingGas().toString() + '+' + SOME_MARGIN.toString();
        return stringToBytes(allPixelsDetails); // Convert string data to bytes for return
      }

      let key = `${x},${y}`; // Construct the storage key for the current pixel
      if (COLOR.contains(key)) {
        let color = COLOR.get(key, 'FFFFFF'); // Pixel color
        let owner = OWNER.get(key, 'not_yet_owned'); // Pixel owner
        let price = PRICE.get(key, u64(10 ** 8)); // Pixel price
        // Accumulate the details with the specified delimiter
        allPixelsDetails += `${x},${y},${color},${owner},${price}${delimiter}`;
      }
    }
  }
  // After iterating through all pixels, append the remaining gas info to the details
  allPixelsDetails += remainingGas().toString() + '+' + SOME_MARGIN.toString();
  generateEvent('All pixels sent'); // Generate an event indicating all pixel details have been sent
  return stringToBytes(allPixelsDetails); // Convert the final string of pixel details into bytes and return
}
