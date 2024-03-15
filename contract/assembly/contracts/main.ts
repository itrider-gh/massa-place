import { Storage, Context, generateEvent, Address, remainingGas, publicKeyToAddress } from '@massalabs/massa-as-sdk';
import { Args, stringToBytes } from '@massalabs/as-types';

export function constructor(_: StaticArray<u8>): void {
  if (!Context.isDeployingContract()) {
    return;
  }
  
  const defaultOwnerAddress = "AU12bKxFSXjC9T7tri8AcPu3jknboNzP8g75f3SzfbCUhhigcokYJ";
  const defaultColor = "FFFFFF"; // Couleur par défaut pour les pixels
  
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      let key = `${x},${y}`;
      // Utiliser toString() pour convertir l'adresse en chaîne de caractères si nécessaire
      let value = defaultColor + ":" + defaultOwnerAddress; // Format "couleur:adresse"
      Storage.set(key, value);
    }
  }
}

/**
 * @param _args - Les coordonnées x et y du pixel et la nouvelle couleur, sérialisées.
 */


//Setter
export function changePixelColor(_args: StaticArray<u8>): void {
  let args = new Args(_args);
  
  // Extraire les coordonnées x et y, ainsi que la nouvelle couleur des arguments
  let x = args.nextU32().expect('Missing x coordinate.');
  let y = args.nextU32().expect('Missing y coordinate.');
  let newColor = args.nextString().expect('Missing new color.');

  // Identifier l'appelant de la fonction
  let callerAddress = Context.caller().toString();
  
  let key = `${x},${y}`;
  
  // Vérifier si le pixel existe
  if (!Storage.has(key)) {
    generateEvent(`Pixel at ${key} not found.`);
    return;
  }

  // Récupérer la valeur actuelle pour ce pixel
  let value = Storage.get(key);
  let parts = value.split(":");
  let owner = parts.length > 1 ? parts[1] : "";
  
  // Vérifier si l'appelant est le propriétaire du pixel
  if (callerAddress !== owner) {
    throw new Error(`Unauthorized: Caller ${callerAddress} is not the owner of pixel at ${key}.`);
  }

  // Mise à jour de la couleur du pixel tout en conservant l'adresse du propriétaire
  Storage.set(key, newColor + ":" + owner);

  // Générer un événement pour notifier que la couleur du pixel a été changée
  generateEvent(`Color of pixel at ${key} changed to ${newColor}. Owner remains ${owner}.`);
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

export function getAllPixelColors(_: StaticArray<u8>): StaticArray<u8> {
  let allColors = "";
  const colorDelimiter = ";"; // Pour séparer chaque paire couleur-propriétaire
  const infoDelimiter = ","; // Pour séparer la couleur du propriétaire dans chaque paire
  const gasDelimiter = "|"; // Pour séparer les couleurs du gas restant

  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      let key = `${x},${y}`;
      if (Storage.has(key)) {
        let value = Storage.get(key);
        let parts = value.split(":"); // Séparation de la chaîne sans déstructuration
        let color = parts[0];
        let owner = parts.length > 1 ? parts[1] : ""; // Gestion sécurisée de l'adresse du propriétaire
        // Ajoute la paire couleur-propriétaire avec le délimiteur approprié
        allColors += color + infoDelimiter + owner + colorDelimiter;
      } else {
        // Si aucune information n'est trouvée pour un pixel, ajoutez une valeur par défaut
        allColors += "FFFFFF" + infoDelimiter + "none" + colorDelimiter; // Couleur blanche et propriétaire "none" par défaut
      }
    }
  }

  // Ajouter le gas restant à la fin de la chaîne de caractères
  let remainingGasStr = remainingGas().toString();
  allColors += gasDelimiter + "remainingGas:" + remainingGasStr;

  // Générer un événement pour le débogage ou le suivi
  generateEvent("Retrieved all pixel colors with remaining gas");

  // Renvoyer toutes les couleurs et propriétaires concaténés, ainsi que le gas restant
  return stringToBytes(allColors);
}
