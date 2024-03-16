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
} from "@massalabs/massa-web3";

const CONTRACT_ADDRESS = "AS12mKEUunrCvBHDoWBeQUSoHPrcooAuLhKsXivVUf592Aw2QN8rQ";

function App() {
  const [client, setWeb3client] = useState<Client | null>(null);
  // Modification pour inclure la position des pixels
  const [pixels, setPixels] = useState<Array<{ x: number; y: number; color: string; owner: string; price: number }>>([]);
  const [selectedPixel, setSelectedPixel] = useState<{ x: number; y: number; color: string; owner: string; price: number } | null>(null);
  const [newPrice, setNewPrice] = useState(0);
  const [newColor, setNewColor] = useState('#000000'); // Initial state for new color

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
      });
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
    fetchCanvasColors();
  }, [client]);

  async function buyPixel(x: number, y: number, price: number) {
    if (!client) return;

    try {
      const args = new Args().addU32(x).addU32(y).serialize();
      await client.smartContracts().callSmartContract({
        targetAddress: CONTRACT_ADDRESS,
        functionName: "buyPixel",
        parameter: args,
        maxGas: BigInt(3980167295),
        coins: BigInt(fromMAS(price)),
        fee: BigInt(fromMAS(0.1)),
      });
      console.log(`Attempted to buy pixel at (${x}, ${y})`);
      setTimeout(fetchCanvasColors, 8000); // Refresh pixel data
    } catch (error) {
      console.error("Error buying pixel:", error);
    }
  }

  const updatePixelPrice = async (x: number, y: number, price: number) => {
    if (!client) return;
    
    try {
      const args = new Args().addU32(x).addU32(y).addString(price.toString()).serialize();
      await client.smartContracts().callSmartContract({
        targetAddress: CONTRACT_ADDRESS,
        functionName: "setPixelPrice",
        parameter: args,
        maxGas: BigInt(3980167295),
        coins: BigInt(0), // Pas besoin d'envoyer des coins pour cette opération
        fee: BigInt(fromMAS(0.1)), // Assurez-vous d'avoir suffisamment pour couvrir les frais
      });
      console.log(`Price updated for pixel at (${x}, ${y}) to ${price} MAS`);
      setTimeout(fetchCanvasColors, 8000); // Rafraîchissement des données
    } catch (error) {
      console.error("Error updating pixel price:", error);
    }
  };

  async function changePixelColor(x: number, y: number, color: string) {
    if (!client) return;
  
    // Convert color from #RRGGBB to RRGGBB format expected by smart contract
    const colorWithoutHash = color.slice(1);
  
    try {
      const args = new Args().addU32(x).addU32(y).addString(colorWithoutHash).serialize();
      await client.smartContracts().callSmartContract({
        targetAddress: CONTRACT_ADDRESS,
        functionName: "changePixelColor",
        parameter: args,
        maxGas: BigInt(3980167295),
        coins: BigInt(0), // Assuming no MAS is required to change color; adjust if needed
        fee: BigInt(fromMAS(0.1)),
      });
      console.log(`Changed color of pixel at (${x}, ${y}) to ${color}`);
      setTimeout(fetchCanvasColors, 8000); // Refresh pixels data
    } catch (error) {
      console.error("Error changing pixel color:", error);
    }
  }

  return (
    <div className="App">
      <h1>Massa Place</h1>
      <div className="canvas">
        {pixels.map((pixel, index) => (
          <div
            key={`${pixel.x}-${pixel.y}`}
            className="pixel"
            style={{ backgroundColor: pixel.color }}
            title={`Owner: ${pixel.owner} | Price: ${pixel.price} MAS`}
            onClick={() => setSelectedPixel(pixel)}
          ></div>
        ))}
      </div>
      {selectedPixel && (
        <div>
          <p>Selected Pixel: {selectedPixel.x}, {selectedPixel.y}</p>
          <p>Color: {selectedPixel.color}</p>
          <p>Owner: {selectedPixel.owner}</p>
          <p>Price: {selectedPixel.price} MAS</p>
          <button onClick={() => buyPixel(selectedPixel.x, selectedPixel.y, selectedPixel.price)}>Buy Pixel</button>
          <input
            type="text"
            value={newPrice}
            onChange={(e) => setNewPrice(Number(e.target.value))}
            placeholder="New Price (MAS)"
          />
          <button onClick={() => updatePixelPrice(selectedPixel.x, selectedPixel.y, newPrice)}>Set New Price</button>
          {/* New color input and button to change color */}
          <input
            type="color"
            value={newColor} // This state needs to be defined and managed similarly to newPrice
            onChange={(e) => setNewColor(e.target.value)}
          />
          <button onClick={() => changePixelColor(selectedPixel.x, selectedPixel.y, newColor)}>Change Color</button>
        </div>
      )}
    </div>
  );
}

export default App;
