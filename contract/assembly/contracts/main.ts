import { Storage, Context, generateEvent, Address, remainingGas, publicKeyToAddress, transferredCoins } from '@massalabs/massa-as-sdk';
import { Args, stringToBytes } from '@massalabs/as-types';

export function constructor(_: StaticArray<u8>): void {
  if (!Context.isDeployingContract()) {
    return;
  }
  
  const defaultOwner = "not_yet_owned";
  const defaultColor = "FFFFFF"; // Couleur par défaut pour les pixels
  const initialPrice = 0.1; // Prix initial pour chaque pixel
  
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      let key = `${x},${y}`;
      let value = defaultColor + ":" + defaultOwner+ ":" + initialPrice.toString(); // Format "couleur:adresse:prix"
      Storage.set(key, value);
    }
  }
}


/**
 * @param _args
 */


//Setter
export function changePixelColor(_args: StaticArray<u8>): void {
  if (_args.length < 3) {
    throw new Error("Missing arguments for changePixelColor function.");
  }

  let args = new Args(_args);
  let x = args.nextU32().expect('Missing x coordinate.');
  let y = args.nextU32().expect('Missing y coordinate.');
  let newColor = args.nextString().expect('Missing new color.');

  let key = `${x},${y}`;

  if (!Storage.has(key)) {
    throw new Error(`Pixel at ${key} not found.`);
  }

  let value = Storage.get(key);
  let parts = value.split(":");
  if (parts.length < 3) {
    throw new Error("Pixel data is corrupted or missing information.");
  }

  let currentColor = parts[0];
  let currentOwner = parts[1];
  let price = parts[2]; // Maintaining the price as is, or it could be updated if necessary.

  let callerAddress = Context.caller().toString();
  if (callerAddress !== currentOwner && currentOwner !== "not_yet_owned") {
    throw new Error(`Unauthorized: Caller ${callerAddress} is not the owner of pixel at ${key}.`);
  }
  
  Storage.set(key, `${newColor}:${currentOwner}:${price}`);
  generateEvent(`Color of pixel at ${key} changed to ${newColor}. Owner remains ${currentOwner}.`);
}

export function buyPixel(_args: StaticArray<u8>): void {
  if (_args.length < 2) {
    throw new Error("Missing arguments for buyPixel function.");
  }

  let args = new Args(_args);
  let x = args.nextU32().expect('Missing x coordinate.');
  let y = args.nextU32().expect('Missing y coordinate.');

  let key = `${x},${y}`;

  if (!Storage.has(key)) {
    throw new Error(`Pixel at ${key} not found.`);
  }

  let value = Storage.get(key);
  let parts = value.split(":");
  if (parts.length < 3) {
    throw new Error("Pixel data is corrupted or missing information.");
  }

  let currentColor = parts[0];
  let currentOwner = parts[1];
  let price = parts[2];

  if (price === "not_for_sale") {
    throw new Error(`Pixel at ${key} is not for sale.`);
  }

  let priceAsNumber = u64(parseFloat(price));
  let transferredAmount = transferredCoins();

  if (transferredAmount < priceAsNumber) {
    throw new Error(`Not enough coins transferred: required ${price}, but got ${transferredAmount}.`);
  }

  let buyerAddress = Context.caller().toString();

  let newColor = (currentOwner === "not_yet_owned") ? "000000" : currentColor;
  Storage.set(key, `${newColor}:${buyerAddress}:not_for_sale`);
  generateEvent(`Pixel at ${key} now owned by ${buyerAddress} with new color ${newColor}. No longer for sale.`);
}


export function setPixelPrice(_args: StaticArray<u8>): void {
  if (_args.length < 3) {
    throw new Error("Missing arguments for setPixelPrice function.");
  }

  let args = new Args(_args);
  let x = args.nextU32().expect('Missing x coordinate.');
  let y = args.nextU32().expect('Missing y coordinate.');
  let newPrice = args.nextString().expect('Missing new price.');

  let key = `${x},${y}`;

  if (!Storage.has(key)) {
    throw new Error(`Pixel at ${key} not found.`);
  }

  let value = Storage.get(key);
  let parts = value.split(":");
  if (parts.length < 3) {
    throw new Error("Pixel data is corrupted or missing information.");
  }

  let currentColor = parts[0];
  let currentOwner = parts[1];

  let callerAddress = Context.caller().toString();
  if (callerAddress !== currentOwner) {
    throw new Error(`Unauthorized: Caller ${callerAddress} is not the owner of pixel at ${key}.`);
  }

  Storage.set(key, `${currentColor}:${currentOwner}:${newPrice}`);
  generateEvent(`Price of pixel at ${key} changed to ${newPrice} by owner ${currentOwner}.`);
}


// Getter
export function getPixelColor(_args: StaticArray<u8>): StaticArray<u8> {
  let args = new Args(_args);
  let x = args.nextU32().expect('Missing x coordinate.');
  let y = args.nextU32().expect('Missing y coordinate.');

  let key = `${x},${y}`;
  if (!Storage.has(key)) {
    generateEvent("No pixel found at " + key);
    return stringToBytes("No pixel found");
  }

  let value = Storage.get(key);
  let parts = value.split(":"); // Séparation de la chaîne sans déstructuration
  let color = parts[0];
  let owner = parts.length > 1 ? parts[1] : ""; // Gestion sécurisée de l'adresse du propriétaire
  generateEvent(`Color of pixel at ${key} is ${color} with owner ${owner}`);
  return stringToBytes(value); // Retour de "couleur:adresse"
}

// Function to retrieve all pixels' detailed information as a string
export function getAllPixelsDetails(_: StaticArray<u8>): StaticArray<u8> {
  let allPixelsDetails = ""; // Initialize an empty string to accumulate pixel info
  const delimiter = "|"; // Delimiter for separating individual pixel info

  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      let key = `${x},${y}`;
      if (Storage.has(key)) {
        let value = Storage.get(key);
        let parts = value.split(":");
        // Ensure there are three parts: color, owner, and price
        if (parts.length == 3) {
          let color = parts[0];
          let owner = parts[1];
          let price = parts[2];
          // Append pixel information to the string
          allPixelsDetails += `${x},${y},${color},${owner},${price}${delimiter}`;
        }
      }
    }
  }
  // Convert the final string to a StaticArray<u8> for return
  return stringToBytes(allPixelsDetails);
}