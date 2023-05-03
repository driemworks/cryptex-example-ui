/* global BigInt */
import './App.css';
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { useWasm } from './useWasm';
import { useEffect, useReducer, useState } from 'react';
import { create } from 'ipfs-http-client';
import CreateSociety from './components/create-society/create-society.component';
import Memberships from './components/membership/membership.component';
import FileSystem from './components/fs/fs.component';
import SharedData from './components/shared/shared.component';
// TODO: use extension to get account
// https://polkadot.js.org/docs/extension/usage/
function App() {
  // make sure the wasm blob is loaded
  useWasm();

  const [ipfs, setIpfs] = useState(null);
  const [api, setApi] = useState(null);
  const [acct, setAcct] = useState(null);

  useEffect(() => {
    const host = "127.0.0.1";
    const port = "9944";
    const ipfsPort = "5001";
    let provider = new WsProvider(`ws://${host}:${port}`);
    const setup = async () => {
      const ipfs = await create({
        host: host,
        port: ipfsPort,
        protocol: 'http',
    });
    let id = await ipfs.id();
    if (id !== null) {
        setIpfs(ipfs);
    }
      setIpfs(ipfs)
      // setup api for blockchain
      const api = await ApiPromise.create({
        provider,
        types: {
          SocietyId: "Bytes",
        }
      });
      await api.isReady;
      setApi(api);
      // load ALICE account
      const keyring = new Keyring({ type: 'sr25519' });
      let aliceAcct = keyring.addFromUri("//Alice");
      setAcct(aliceAcct);
      await initEventListener(api, aliceAcct);
    }
    setup();
  }, []);
  
  const initEventListener = async (api, acct) => {
      // Subscribe to system events via storage
    api.query.system.events((events) => {
      // console.log(`\nReceived ${events.length} events:`);
      events.forEach(async (record) => {
        // Extract the phase, event and the event types
        const { event, phase } = record;
        const eventMethod = event.method;
        // if (eventMethod === 'CreatedSociety') {
        //   await updateMembershipMaps(api, acct);
        // }
      });
    });
  }

  return (
    <div className="App">
      <div className='header'>
        <h2>Enigma</h2>
        <span>
          Api is { api === null ? 'not' : '' } ready
        </span>
      </div>
      <div className='body'>
        <div className='section'>
          <Memberships 
            api={api} 
            acct={acct} 
            ipfs={ipfs}
          />
        </div>
        <div className='section'>
          <FileSystem api={api} acct={acct} />
        </div>
        <div className='section'>
          <CreateSociety api={api} acct={acct} />
        </div>
        <div>
        <SharedData acct={acct} api={api} ipfs={ipfs} />
        </div>
      </div>
    </div>
  );
}

export default App;
