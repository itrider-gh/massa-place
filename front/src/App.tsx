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

const CONTRACT_ADDRESS = "AS12QXyw7BDeLepnAVwoupf2xzrkYwv5cnVKasikvo2LncU8UAiLA";

function App() {
  const [client, setWeb3client] = useState<Client | null>(null);
  const [pixels, setPixels] = useState<Array<string>>(Array(100).fill("#FFFFFF"));

  // Génère un entier aléatoire entre min (inclus) et max (exclus)
  function getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min) + min);
  }


  // Génère une couleur hexadécimale aléatoire
  function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '';
    for (let i = 0; i < 6; i++) {
      color += letters[getRandomInt(0, 16)];
    }
    return color;
  }

  async function changeRandomPixelColor() {
    if (!client) return;

    const x = getRandomInt(0, 10); // Coordonnée x aléatoire entre 0 et 9
    const y = getRandomInt(0, 10); // Coordonnée y aléatoire entre 0 et 9
    const color = getRandomColor(); // Couleur aléatoire

    try {
      const args = new Args().addU32(x).addU32(y).addString(color).serialize();
      await client.smartContracts().callSmartContract({
        targetAddress: CONTRACT_ADDRESS,
        functionName: "changePixelColor",
        parameter: args,
        maxGas: BigInt(3980167295),
        coins: BigInt(0),
        fee: BigInt(fromMAS(0.1)),
      });
      console.log(`Changed pixel at (${x}, ${y}) to #${color}`);
      // Rafraîchir les couleurs des pixels après le changement
      fetchCanvasColors();
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    const initClientWithBearby = async () => {
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

    initClientWithBearby().catch(console.error);
  }, []);

  useEffect(() => {
    fetchCanvasColors();
  }, [client]);

  const fetchCanvasColors = async () => {
    if (!client) return;

    try {
      const res = await client.smartContracts().readSmartContract({
        targetAddress: CONTRACT_ADDRESS,
        targetFunction: "getAllPixelColors",
        parameter: new Args().serialize(),
        maxGas: BigInt(3980167295),
      });
      const fullStr = bytesToStr(res.returnValue);
      const gasInfoIndex = fullStr.indexOf("remainingGas:");
      const colorsStr = fullStr.substring(0, gasInfoIndex);
      const remainingGasStr = fullStr.substring(gasInfoIndex).replace("remainingGas:", "");
      const colorsArray = colorsStr.split(';').filter(c => c);

      console.log(`Remaining gas: ${remainingGasStr}`);
      if (colorsArray.length === 100) {
        setPixels(colorsArray.map(color => `#${color}`));
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="App">
      <h1>Canvas Colors</h1>
      <button onClick={changeRandomPixelColor}>Change Random Pixel Color</button>
      <div className="canvas">
        {pixels.map((color, index) => (
          <div key={index} className="pixel" style={{ backgroundColor: color }}></div>
        ))}
      </div>
    </div>
  );
}

export default App;
