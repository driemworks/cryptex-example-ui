/* global BigInt */
import './App.css';
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { useWasm } from './useWasm';
import React, { useEffect, useReducer, useState } from 'react';
import { create } from 'ipfs-http-client';
import CreateSociety from './components/create-society/create-society.component';
import Memberships from './components/membership/membership.component';
import FileSystem from './components/fs/fs.component';
import SharedData from './components/shared/shared.component';


import { Sidebar, Menu, MenuItem } from 'react-pro-sidebar';
import Events from './events.component';
import { Button, IconButton, Snackbar, TextField, Tooltip } from '@mui/material';
import TruncatedDisplay from './components/common/truncate-display.component';


// TODO: use extension to get account
// https://polkadot.js.org/docs/extension/usage/
function App() {
  // make sure the wasm blob is loaded
  useWasm();

  const [ignored, forceUpdate] = useReducer(x => x + 1, 0);

  const [ipfs, setIpfs] = useState(null);
  const [api, setApi] = useState(null);
  const [kr, setKr] = useState(null);
  const [acct, setAcct] = useState(null);
  const [editUri, setEditUri] = useState(false);

  const [newUri, setNewUri] = useState('');
  const [blockNumber, setBlockNumber] = useState(0);

  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('9944');
  const [ipfsPort, setIPfsPort] = useState('5001');
  const [uri, setUri] = useState('');

  useEffect(() => {
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
      let uriAcct = keyring.addFromUri(uri);
      setAcct(uriAcct);
      setKr(keyring);
      await initEventListener(api, uriAcct);
      await blockListener(api);
    }
    setup();
  }, [uri]);
  
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

  // TODO: listen and display current block number
  const blockListener = async (api)=> {
    //  await api.rpc.chain.subscribeNewHeads((header) => {
    //   setBlockNumber(header.number.toHuman());
    // });
  }

  const [activeComponentName, setActiveComponentName] = useState('');
  const [ActiveComponent, setActiveComponent] = useState(<div></div>);

  const handleSetDisplay = (componentName) => {
    setActiveComponentName(componentName);
    if (componentName === 'create') {
      setActiveComponent(<CreateSociety api={api} acct={acct} />);
    } else if (componentName === 'memberships') {
      setActiveComponent(<Memberships 
        api={api} 
        acct={acct} 
        ipfs={ipfs}
      />);
    } else if (componentName === 'filesystem') {
      setActiveComponent(<FileSystem api={api} acct={acct} />);
    } else if (componentName === 'shared') {
      setActiveComponent(<SharedData acct={acct} api={api} ipfs={ipfs} />);
    } else {
      setActiveComponent(<div>Well, this should not have happened...</div>);
    }
  }

  return (
    <div className="App">
      <div className='header'>
        <div className='title'>
          <h2>Enigma</h2>
        </div>
        <div className='header-details'>
          <span>
            Api is { api === null ? 'not' : '' } ready
          </span>
          { acct === null ? <div>connect Wallet</div> :
          <TruncatedDisplay data={acct.address} message="Address: " /> }
        </div>
      </div>
      <div className='body'>
        { uri === '' ?
        <div>
          {api === null ? <div>API not ready</div> :
          <div>
            <label htmlFor='uri'>Set URI</label>
            <input id='uri' type="text" value={newUri} onChange={e => { setNewUri(e.target.value) }} />
            <Button onClick={() => { forceUpdate(); setUri(newUri); }}>Submit</Button>
          </div>
        }
        </div>
        : <div className='content'>
          <Sidebar>
            <Menu>
              <MenuItem onClick={() => handleSetDisplay('create')}>Create Society</MenuItem>
              <MenuItem onClick={() => handleSetDisplay('memberships')}>Societies</MenuItem>
              <MenuItem onClick={() => handleSetDisplay('filesystem')}>View Files</MenuItem>
              <MenuItem onClick={() => handleSetDisplay('shared')}>Shared With You</MenuItem>
            </Menu>
          </Sidebar>
          { ActiveComponent }
        </div>
        }
      </div>
      {/* <Events api={api} /> */}
    </div>
  );
}

export default App;
 