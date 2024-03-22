import { 
  Storage, 
  Context, 
  generateEvent, 
  remainingGas, 
  transferredCoins, 
  createEvent, 
} from '@massalabs/massa-as-sdk';
import { Args, stringToBytes } from '@massalabs/as-types';

// Constructor function for smart contract deployment
export function constructor(_: StaticArray<u8>): void {
  // Check if the contract is being deployed, if not, exit the function
  if (!Context.isDeployingContract()) {
    return;
  }
  
  // Default values for a pixel
  const defaultOwner = "not_yet_owned"; // Default owner before any purchase
  const defaultColor = "FFFFFF"; // Default color for the pixels
  const initialPrice = 0.1; // Initial price for each pixel
  
  // Initialize 100x100 pixels with default values
  for (let x = 0; x < 100; x++) {
    for (let y = 0; y < 100; y++) {
      let key = `${x},${y}`; // Composite key for storage
      let value = `${defaultColor}:${defaultOwner}:${initialPrice}`; // "color:owner:price" format
      Storage.set(key, value); // Store the pixel data
    }
  }
}

/**
 * Changes the color of multiple pixels
 * @param _args Encoded arguments for the operation
 */
export function changeMultiplePixelsColor(_args: StaticArray<u8>): void {
  // Ensure there's at least one pixel and a color in the arguments
  if (_args.length < 4) {
    throw new Error("Missing arguments for changeMultiplePixelsColor function.");
  }

  // Create an event to indicate the operation is done
  generateEvent(createEvent("Massa Place", ["done"]));

  // Decode the arguments
  let args = new Args(_args);
  let numberOfPixelsToChange = parseFloat(args.nextString().expect('Missing number of pixels to change.'));
  let successfulChanges: string[] = []; // Track successful color changes
  let failedChanges: string[] = []; // Track failed color changes

  // Iterate through each pixel to change its color
  for (let i = 0; i < numberOfPixelsToChange; i++) {
    let x = args.nextU32().expect('Missing x coordinate.');
    let y = args.nextU32().expect('Missing y coordinate.');
    let newColor = args.nextString().expect('Missing new color.');

    let key = `${x},${y}`;

    // Check if the pixel exists
    if (!Storage.has(key)) {
      failedChanges.push(`Pixel at ${key} not found.`);
      continue;
    }

    let value = Storage.get(key);
    let parts = value.split(":");

    // Check for data integrity
    if (parts.length < 3) {
      failedChanges.push(`Pixel data at ${key} is corrupted or missing information.`);
      continue;
    }

    // Only the current owner can change the pixel color
    let currentOwner = parts[1];
    let price = parts[2]; // Keep the price as is

    let callerAddress = Context.caller().toString();
    if (callerAddress !== currentOwner || currentOwner === "not_yet_owned") {
      failedChanges.push(`Unauthorized: Caller ${callerAddress} is not the owner of pixel at ${key}.`);
      continue;
    }
    
    // Update the storage with the new color
    Storage.set(key, `${newColor}:${currentOwner}:${price}`);
    successfulChanges.push(`${key},${newColor}`);
  }

  // Generate events for successful and failed color changes
  successfulChanges.forEach(change => generateEvent(createEvent("Massa Place", ["colorChange", change])));
  failedChanges.forEach(change => generateEvent(createEvent("Massa Place", ["colorChangeError", change])));
}


// Modifies the function to change the price of multiple pixels
export function setMultiplePixelsPrice(_args: StaticArray<u8>): void {
  // Ensure sufficient arguments are passed
  if (_args.length < 4) {
    throw new Error("Missing arguments for setMultiplePixelsPrice function.");
  }

  let args = new Args(_args);
  // Retrieve the number of pixels whose price will be changed
  let numberOfPixelsToChangePrice = parseFloat(args.nextString().expect('Missing number of pixels to change price.'));
  let successfulPriceChanges: string[] = []; // Tracks successful price updates
  let failedPriceChanges: string[] = []; // Tracks failed attempts due to various reasons

  // Iterate through each pixel to update its price
  for (let i = 0; i < numberOfPixelsToChangePrice; i++) {
    let x = args.nextU32().expect('Missing x coordinate.'); // X coordinate
    let y = args.nextU32().expect('Missing y coordinate.'); // Y coordinate
    let newPrice = args.nextString().expect('Missing new price.'); // New price for the pixel

    let key = `${x},${y}`; // Composite key based on coordinates

    // Verify pixel exists before attempting price update
    if (!Storage.has(key)) {
      failedPriceChanges.push(`Pixel at ${key} not found.`);
      continue;
    }

    // Retrieve current pixel data
    let value = Storage.get(key);
    let parts = value.split(":");
    // Ensure data integrity before proceeding
    if (parts.length < 3) {
      failedPriceChanges.push(`Pixel data at ${key} is corrupted or missing information.`);
      continue;
    }

    let currentColor = parts[0]; // Current color
    let currentOwner = parts[1]; // Current owner

    let callerAddress = Context.caller().toString();
    // Update price only if the caller is the current owner
    if (callerAddress !== currentOwner) {
      failedPriceChanges.push(`Unauthorized: Caller ${callerAddress} is not the owner of pixel at ${key}.`);
      continue;
    }

    // Successfully update the pixel's price
    Storage.set(key, `${currentColor}:${currentOwner}:${newPrice}`);
    successfulPriceChanges.push(`${key},${newPrice}`);
  }

  // Generate events for successful and failed price updates
  successfulPriceChanges.forEach(change => generateEvent(createEvent("Massa Place", ["changePrice",change])));
  failedPriceChanges.forEach(change => generateEvent(createEvent("test", [change])));
}


// Function to handle the buying of pixels by users
export function buyPixels(_args: StaticArray<u8>): void {
  let args = new Args(_args);
  // Extract the number of pixels a user intends to buy from the arguments
  let numberOfPixelsToBuy = parseFloat(args.nextString().expect('Missing number of pixels to buy.'));
  // Retrieve the total amount of coins transferred with the transaction
  let totalTransferredAmount = transferredCoins(); // Ensure the correct conversion for your case
  let totalProposedPrice: u64 = 0; // Sum of proposed prices for all pixels intended for purchase
  let successfulPurchases: string[] = []; // Tracks successfully purchased pixels
  let failedPurchases: string[] = []; // Tracks failed purchase attempts
  let refundAmount: u64 = 0; // Tracks the total amount that needs to be refunded

  // First, calculate the total proposed price for all intended pixel purchases
  for (let i = 0; i < numberOfPixelsToBuy; i++) {
    args.nextU32(); // Skip over the x coordinate
    args.nextU32(); // Skip over the y coordinate
    let proposedPrice = parseFloat(args.nextString().expect('Missing proposed price.'));
    totalProposedPrice += u64(proposedPrice);
  }

  // Reset args to read through the pixel details again for processing
  args = new Args(_args);
  args.nextString(); // Skip the first U32, which is the count of pixels to buy

  // Verify if the total amount transferred covers the total proposed price
  if (totalTransferredAmount < totalProposedPrice) {
    throw new Error(`Not enough coins transferred: required ${totalProposedPrice}, but got ${totalTransferredAmount}.`);
  }

  // Process each pixel for purchase
  for (let i = 0; i < numberOfPixelsToBuy; i++) {
    let x = args.nextU32().expect('Missing x coordinate.');
    let y = args.nextU32().expect('Missing y coordinate.');
    // Assume proposed price is a F64 for simplicity
    let proposedPrice = u64(parseFloat(args.nextString().expect('Missing proposed price.')));

    let key = `${x},${y}`;

    // Check if the specified pixel exists
    if (!Storage.has(key)) {
      failedPurchases.push(`Pixel at ${key} not found.`);
      refundAmount += proposedPrice; // Add to the refund amount
      continue;
    }

    let value = Storage.get(key);
    let parts = value.split(":");
    // Validate pixel data and proposed price before proceeding
    if (parts.length < 3 || parts[2] === "not_for_sale" || u64(parseFloat(parts[2])) != proposedPrice) {
      failedPurchases.push(`Pixel at ${key} cannot be bought for the proposed price: ${proposedPrice.toString()}.`);
      refundAmount += proposedPrice; // Add to the refund amount
      continue;
    }

    // Update the pixel data to reflect the new owner and mark it as not for sale
    let buyerAddress = Context.caller().toString();
    Storage.set(key, "000000" + ":" + buyerAddress + ":not_for_sale");
    successfulPurchases.push(`${key},${buyerAddress}.`);
  }

  // Generate events for both successful and failed purchases
  successfulPurchases.forEach(change => generateEvent(createEvent('Massa Place', ['buyPixel', change])));
  failedPurchases.forEach(change => generateEvent(createEvent('test', ['error', change])));

  // Simulate a refund if necessary
  if (refundAmount > 0) {
    generateEvent(createEvent('test', ["Refund needed:", refundAmount.toString()]));
    // The actual refund logic would depend on your specific blockchain environment
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
  let allPixelsDetails = "";
  const delimiter = "|"; // Delimiter to separate pixel details in the string
  // Define a margin for remaining gas to ensure the function doesn't run out of gas
  const SOME_MARGIN = u64(1200000000);

  // Iterate over the pixel grid starting from the provided coordinates
  for (let x = startX; x < 100; x++) {
    for (let y = (x === startX ? startY : 0); y < 100; y++) {
      // Check if the remaining gas is below the defined margin
      if (remainingGas() < SOME_MARGIN) {
        // If gas is running low, return the accumulated pixel details to prevent transaction failure
        generateEvent("Low gas - partial data sent");
        allPixelsDetails += remainingGas().toString() + "+" + SOME_MARGIN.toString();
        return stringToBytes(allPixelsDetails); // Convert string data to bytes for return
      }

      let key = `${x},${y}`; // Construct the storage key for the current pixel
      if (Storage.has(key)) { // Check if the pixel exists in storage
        let value = Storage.get(key); // Retrieve pixel data
        let parts = value.split(":"); // Split the data into components
        // Ensure the pixel data includes color, owner, and price
        if (parts.length == 3) {
          let color = parts[0]; // Pixel color
          let owner = parts[1]; // Pixel owner
          let price = parts[2]; // Pixel price
          // Accumulate the details with the specified delimiter
          allPixelsDetails += `${x},${y},${color},${owner},${price}${delimiter}`;
        }
      }
    }
  }
  // After iterating through all pixels, append the remaining gas info to the details
  allPixelsDetails += remainingGas().toString() + "+" + SOME_MARGIN.toString();
  generateEvent("All pixels sent"); // Generate an event indicating all pixel details have been sent
  return stringToBytes(allPixelsDetails); // Convert the final string of pixel details into bytes and return
}
