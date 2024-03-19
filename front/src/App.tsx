import "./App.css";
import "@massalabs/react-ui-kit/src/global.css";
import { useEffect, useState } from "react";
import { providers } from "@massalabs/wallet-provider";
import {
  ClientFactory,
  Args,
  Client,
  bytesToStr,
  fromMAS,
  EventPoller, 
  IEventFilter,
  IEventRegexFilter,
  INodeStatus,
} from "@massalabs/massa-web3";

const CONTRACT_ADDRESS = "AS1mVtjRU5HH5EREDFgJCpmG6ueo2YCmT96xhDNChk9VprGUL3Zv";

function App() {
  const [client, setWeb3client] = useState<Client | null>(null);
  // Modification pour inclure la position des pixels
  const [pixels, setPixels] = useState<Array<{ x: number; y: number; color: string; owner: string; price: number }>>([]);
  const [selectedPixel, setSelectedPixel] = useState<{ x: number; y: number; color: string; owner: string; price: number } | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [newColor, setNewColor] = useState('#000000'); // Initial state for new color 
  const [nodeStatusInfo, setNodeStatusInfo] = useState<INodeStatus | null>(null);
  const [isPollingStarted, setIsPollingStarted] = useState<boolean>(false);
  
  
  // Définition du type pour un pixel simple
  type PixelSimple = {
    x: number;
    y: number;
    price: number;
    color: string;
  };

  // Initialisation correcte de l'état avec un tableau vide et le type spécifié
  const [selectedPixels, setSelectedPixels] = useState<PixelSimple[]>([]);
  
  // Fonction pour ajouter ou supprimer des pixels de la sélection
  const handlePixelClick = (pixel: PixelSimple) => {
    const index = selectedPixels.findIndex(p => p.x === pixel.x && p.y === pixel.y);
    if (index > -1) {
      // Pixel déjà sélectionné, le retirer de la sélection
      setSelectedPixels(selectedPixels.filter((_, i) => i !== index));
    } else {
      // Nouveau pixel, l'ajouter à la sélection
      setSelectedPixels([...selectedPixels, pixel]);
    }
  };


  useEffect(() => {
    if (client && nodeStatusInfo) {
      const eventsFilter: IEventRegexFilter = {
        start: null,
        end: null,
        original_operation_id: null,
        original_caller_address: null,
        emitter_address: CONTRACT_ADDRESS,
        is_final: null,
        eventsNameRegex: "test",
      };
  
      const pollIntervalMillis = 1000; // Fréquence de polling en millisecondes
  
      // Commencer à écouter les événements
      const eventPoller = EventPoller.startEventsPolling(
        eventsFilter,
        pollIntervalMillis,
        client,
        (data) => {
          console.log('Événements capturés:', data);
          //setEvents(data); // Met à jour l'état avec les nouveaux événements
        },
        (error) => {
          console.error('Erreur lors du polling:', error);
        }
      );

      setIsPollingStarted(true);


      // Nettoyage lors du démontage du composant
      return () => {
        eventPoller.stopPolling();
      };
    }
  }, [client, nodeStatusInfo]);

  

  useEffect(() => {
    const initClient = async () => {
      const MassaStationProvider = (await providers(true)).find(p => p.name() === "MASSASTATION");
      if (!MassaStationProvider) {
        console.error("MassaStation provider not found");
        return;
      }
      const accounts = await MassaStationProvider.accounts();
      if (accounts.length === 0) {
        console.error("No accounts found with MassaStation provider");
        return;
      }
      const client = await ClientFactory.fromWalletProvider(MassaStationProvider, accounts[1], false);
      setWeb3client(client);
      const nodeStatusInfo = await client.publicApi().getNodeStatus();
      setNodeStatusInfo(nodeStatusInfo);
    };

    initClient().catch(console.error);
  }, []);

  const fetchCanvasColors = async () => {
    if (!client) return;
    try {
      const res = await client.smartContracts().readSmartContract({
        targetAddress: CONTRACT_ADDRESS,
        targetFunction: "getAllPixelsDetails",
        parameter: new Args().serialize(),
        maxGas: BigInt(3980167295),
      })
      console.log(res.info.output_events);
      const fullStr = bytesToStr(res.returnValue);
      const [pixelsDetailsStr] = fullStr.split("|remainingGas:");
      const pixelsData = pixelsDetailsStr.split("|").map(entry => {
        const [x, y, color, owner, price] = entry.split(",");
        return {
          x: parseInt(x, 10),
          y: parseInt(y, 10),
          color: `#${color}`,
          owner,
          price: parseFloat(price),
        };
      });

      setPixels(pixelsData);
      console.log("done");
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if(isPollingStarted){
      setTimeout(fetchCanvasColors, 5000);
    }
  }, [client, isPollingStarted]);



  async function buyPixels() {
    if (!client || selectedPixels.length === 0) return;
  
    try {
      let args = new Args().addString(selectedPixels.length.toString());
      console.log(selectedPixels.length.toString());
      selectedPixels.forEach(pixel => {
        args.addU32(pixel.x).addU32(pixel.y).addString(pixel.price.toString());
        console.log(pixel.price.toString());
      });
  
      const serializedArgs = args.serialize();
      const totalPrice = selectedPixels.reduce((sum, { price }) => sum + price, 0);
  
      await client.smartContracts().callSmartContract({
        targetAddress: CONTRACT_ADDRESS,
        functionName: "buyPixels",
        parameter: serializedArgs,
        maxGas: BigInt(3980167295),
        coins: BigInt(fromMAS(totalPrice)),
        fee: BigInt(fromMAS(1)),
      })
      console.log(`Attempted to buy ${selectedPixels.length} pixels`);
      setSelectedPixels([]); // Vider la sélection après l'achat
      setTimeout(fetchCanvasColors, 5000);
    } catch (error) {
      console.error("Error buying pixels:", error);
    }
  }

  const updateMultiplePixelsPrice = async () => {
    if (!client) return;
    
    try {
      // Initialisation des arguments avec le nombre de pixels à modifier
      let args = new Args().addString(selectedPixels.length.toString());
      
      // Ajout des coordonnées x, y et des prix pour chaque pixel dans les arguments
      selectedPixels.forEach(pixel => {
        args = args.addU32(pixel.x).addU32(pixel.y).addString(newPrice);
      });

      const serializedArgs = args.serialize();

      await client.smartContracts().callSmartContract({
        targetAddress: CONTRACT_ADDRESS,
        functionName: "setMultiplePixelsPrice",
        parameter: serializedArgs,
        maxGas: BigInt(3980167295),
        coins: BigInt(0), // Pas besoin d'envoyer des coins pour cette opération
        fee: BigInt(fromMAS(0.1)), // Assurez-vous d'avoir suffisamment pour couvrir les frais
      });
      console.log(`Prices updated for multiple pixels.`);
      setTimeout(fetchCanvasColors, 8000); // Rafraîchissement des données
    } catch (error) {
      console.error("Error updating pixel prices:", error);
    }
  }

  async function changeMultiplePixelsColor() {
    if (!client || selectedPixels.length === 0) return;

    try {
        let args = new Args().addString(selectedPixels.length.toString());
        selectedPixels.forEach(pixel => {
            const colorWithoutHash = newColor.slice(1); // Enlever le # pour la couleur
            args.addU32(pixel.x).addU32(pixel.y).addString(colorWithoutHash);
        });

        const serializedArgs = args.serialize();

        await client.smartContracts().callSmartContract({
            targetAddress: CONTRACT_ADDRESS,
            functionName: "changeMultiplePixelsColor",
            parameter: serializedArgs,
            maxGas: BigInt(3980167295),
            coins: BigInt(0), // Pas de coût en MAS pour changer la couleur, ajustez si nécessaire
            fee: BigInt(fromMAS(0.1)),
        });
        console.log(`Attempted to change colors of ${selectedPixels.length} pixels`);
        setSelectedPixels([]); // Vider la sélection après le changement
        setTimeout(fetchCanvasColors, 5000); // Rafraîchir les données des pixels
    } catch (error) {
        console.error("Error changing pixels color:", error);
    }
}

return (
  <div className="App">
    <h1>Massa Place</h1>
    <div className="canvas">
      {pixels.map((pixel) => (
        <div
          key={`${pixel.x}-${pixel.y}`}
          className={`pixel ${selectedPixels.find(p => p.x === pixel.x && p.y === pixel.y) ? 'selected' : ''}`} 
          style={{ backgroundColor: pixel.color }}
          title={`Owner: ${pixel.owner} | Price: ${pixel.price} MAS`}
          onClick={() => handlePixelClick({ x: pixel.x, y: pixel.y, price: pixel.price, color: pixel.color })} 
        />
      ))}
    </div>
    {selectedPixels.length > 0 && (
      <div>
        <button onClick={buyPixels}>Buy Selected Pixels</button>
        <div>
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
          />
          <button onClick={() => changeMultiplePixelsColor()}>Apply New Color</button>
        </div>
        <input
          type="number"
          value={newPrice}
          onChange={(e) => setNewPrice(e.target.value)}
          placeholder="New Price"
        />
        <button onClick={updateMultiplePixelsPrice}>Update Price for Selected Pixels</button>
      </div>
    )}
  </div>
);
}

export default App;
