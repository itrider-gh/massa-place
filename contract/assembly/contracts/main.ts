import { Storage, Context, generateEvent, Address, remainingGas, publicKeyToAddress, transferredCoins, createEvent, timestamp } from '@massalabs/massa-as-sdk';
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


// Modification de la fonction pour changer le prix de plusieurs pixels
export function setMultiplePixelsPrice(_args: StaticArray<u8>): void {
  if (_args.length < 4) {
    throw new Error("Missing arguments for setMultiplePixelsPrice function.");
  }

  generateEvent(createEvent("test", ["done"]));


  let args = new Args(_args);
  let numberOfPixelsToChangePrice = parseFloat(args.nextString().expect('Missing number of pixels to change price.'));
  let successfulPriceChanges: string[] = [];
  let failedPriceChanges: string[] = [];

  for (let i = 0; i < numberOfPixelsToChangePrice; i++) {
    let x = args.nextU32().expect('Missing x coordinate.');
    let y = args.nextU32().expect('Missing y coordinate.');
    let newPrice = args.nextString().expect('Missing new price.');

    let key = `${x},${y}`;

    if (!Storage.has(key)) {
      failedPriceChanges.push(`Pixel at ${key} not found.`);
      continue;
    }

    let value = Storage.get(key);
    let parts = value.split(":");
    if (parts.length < 3) {
      failedPriceChanges.push(`Pixel data at ${key} is corrupted or missing information.`);
      continue;
    }

    let currentColor = parts[0];
    let currentOwner = parts[1];

    let callerAddress = Context.caller().toString();
    if (callerAddress !== currentOwner) {
      failedPriceChanges.push(`Unauthorized: Caller ${callerAddress} is not the owner of pixel at ${key}.`);
      continue;
    }

    // Update pixel data with the new price while maintaining color and owner
    Storage.set(key, `${currentColor}:${currentOwner}:${newPrice}`);
    successfulPriceChanges.push(`Price of pixel at ${key} changed to ${newPrice} by owner ${currentOwner}.`);
  }

  // Generate events for both successful and failed price changes
  successfulPriceChanges.forEach(change => generateEvent(createEvent("test", [change])));
  failedPriceChanges.forEach(change => generateEvent(createEvent("test", [change])));
}

export function buyPixels(_args: StaticArray<u8>): void {
  let args = new Args(_args);
  let numberOfPixelsToBuy = parseFloat(args.nextString().expect('Missing number of pixels to buy.'));
  let totalTransferredAmount = transferredCoins(); // Assurez-vous que cette conversion est correcte pour votre cas
  let totalProposedPrice: u64 = 0; // Somme des prix proposés
  let successfulPurchases: string[] = [];
  let failedPurchases: string[] = [];
  let refundAmount: u64 = 0;

  // Calculez d'abord la somme des prix proposés pour tous les pixels
  for (let i = 0; i < numberOfPixelsToBuy; i++) {
    args.nextU32();
    args.nextU32();
    let proposedPrice = parseFloat(args.nextString().expect('Missing proposed price.'));
    generateEvent(createEvent("test",["ProposedPrice",proposedPrice.toString()]));
    totalProposedPrice += u64(proposedPrice);
  }

  generateEvent(createEvent("test",["NumberOfPixels",numberOfPixelsToBuy.toString()]));

  generateEvent(createEvent("test",["TotalProposedPrice",(totalProposedPrice).toString()]));

  generateEvent(createEvent("test",["transferAmount",(totalTransferredAmount).toString()]));

  // Réinitialisez args pour relire les données depuis le début
  args = new Args(_args);
  args.nextString(); // Ignorez le premier U32 qui est le nombre de pixels à acheter

  // Vérifiez si le montant total transféré couvre la somme des prix proposés
  if (totalTransferredAmount < totalProposedPrice) {
    throw new Error(`Not enough coins transferred: required ${totalProposedPrice}, but got ${totalTransferredAmount}.`);
  }


  for (let i = 0; i < numberOfPixelsToBuy; i++) {
    let x = args.nextU32().expect('Missing x coordinate.');
    let y = args.nextU32().expect('Missing y coordinate.');
    let proposedPrice = u64(parseFloat(args.nextString().expect('Missing proposed price.'))); // Supposons que le prix proposé est un F64

    let key = `${x},${y}`;

    if (!Storage.has(key)) {
      failedPurchases.push(`Pixel at ${key} not found.`);
      refundAmount += proposedPrice; // Ajouter au montant de remboursement
      continue;
    }

    let value = Storage.get(key);
    let parts = value.split(":");
    if (parts.length < 3 || parts[2] === "not_for_sale" || u64(parseFloat(parts[2])) != proposedPrice) {
      failedPurchases.push(`Pixel at ${key} cannot be bought for the proposed price: ${proposedPrice.toString()}.`);
      refundAmount += proposedPrice; // Ajouter au montant de remboursement
      continue;
    }

    let buyerAddress = Context.caller().toString();
    Storage.set(key, "000000" + ":" + buyerAddress + ":not_for_sale"); // Mise à jour avec le nouveau propriétaire et marqué comme non disponible à la vente
    successfulPurchases.push(`Pixel at ${key} successfully bought for ${proposedPrice.toString()}.`);
  }

  // Générez des événements pour les achats réussis et échoués
  // Pour les achats réussis
  for (let i = 0; i < successfulPurchases.length; i++) {
    generateEvent(createEvent('test', ['success', successfulPurchases[i]]));
  }

  // Pour les achats échoués
  for (let i = 0; i < failedPurchases.length; i++) {
    generateEvent(createEvent('test', ['error', failedPurchases[i]]));
  }

  // Simulez le remboursement si nécessaire
  if (refundAmount > 0) {
    generateEvent(createEvent('test', ["Refund needed:", refundAmount.toString()]));
    // La logique de remboursement réelle dépendrait de votre environnement blockchain spécifique
  }
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
  generateEvent("Pixels sended");
  return stringToBytes(allPixelsDetails);
}