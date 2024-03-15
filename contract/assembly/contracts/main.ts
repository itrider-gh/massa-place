import { Storage, Context, generateEvent, Utilities, remainingGas } from '@massalabs/massa-as-sdk';
import { Args, stringToBytes } from '@massalabs/as-types';

export function constructor(_: StaticArray<u8>): void {
  if (!Context.isDeployingContract()) {
    return;
  }
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      let key = `${x},${y}`;
      let hash = Utilities.keccak256(stringToBytes(key));
      let color = hashToHexColor(hash); // Utilisez une fonction ajustée
      Storage.set(key, color);
    }
  }
}

/**
 * Change la couleur d'un pixel spécifié par ses coordonnées (x, y).
 *
 * @param _args - Les coordonnées x et y du pixel et la nouvelle couleur, sérialisées.
 */
export function changePixelColor(_args: StaticArray<u8>): void {
  let args = new Args(_args);
  
  // Extraire les coordonnées x et y, ainsi que la nouvelle couleur des arguments
  let x = args.nextU32().expect('Missing x coordinate.');
  let y = args.nextU32().expect('Missing y coordinate.');
  let newColor = args.nextString().expect('Missing new color.');

  let key = `${x},${y}`;

  // Vérifier si le pixel existe
  if (!Storage.has(key)) {
    generateEvent(`Pixel at ${key} not found.`);
    return;
  }

  // Mettre à jour la couleur du pixel
  Storage.set(key, newColor);

  // Générer un événement pour notifier que la couleur du pixel a été changée
  generateEvent(`Color of pixel at ${key} changed to ${newColor}.`);
}

export function getPixelColor(_args: StaticArray<u8>): StaticArray<u8> {
  let args = new Args(_args);
  let x = args.nextU32().expect('Missing x coordinate.');
  let y = args.nextU32().expect('Missing y coordinate.');

  let key = `${x},${y}`;
  if (!Storage.has(key)) {
    generateEvent("No color found for pixel at " + key);
    return stringToBytes("No color found");
  }

  let color = Storage.get(key);
  generateEvent("Color for pixel at " + key + " is " + color);
  return stringToBytes(color);
}

// Fonction ajustée pour convertir un hash en couleur hexadécimale
function hashToHexColor(hash: StaticArray<u8>): string {
  // Prenez directement les valeurs nécessaires sans utiliser `slice`
  return hash.reduce<string>((prev, curr, index) => {
    if (index < 3) { // Limitez à 3 octets pour une couleur RGB
      return prev + curr.toString(16).padStart(2, '0');
    }
    return prev;
  }, "");
}

export function getAllPixelColors(_: StaticArray<u8>): StaticArray<u8> {
  let allColors = "";
  const delimiter = ";"; // Délimiteur pour séparer les couleurs dans la chaîne retournée

  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      let key = `${x},${y}`;
      if (Storage.has(key)) {
        let color = Storage.get(key);
        allColors += color + delimiter;
      } else {
        // Si aucune couleur n'est trouvée pour un pixel, ajoutez une valeur par défaut ou un indicateur
        allColors += "FFFFFF" + delimiter; // Couleur blanche comme valeur par défaut
      }
    }
  }

  // Ajouter le gas restant à la fin de la chaîne de caractères
  let remainingGasStr = remainingGas().toString();
  allColors += "remainingGas:" + remainingGasStr;

  // Générer un événement pour le débogage ou le suivi
  generateEvent("Retrieved all pixel colors with remaining gas");

  // Renvoyer toutes les couleurs concaténées sous forme d'une chaîne avec le gas restant
  return stringToBytes(allColors);
}
