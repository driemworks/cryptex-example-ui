import './App.css';
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp';

import { useWasm } from './useWasm';
import React, { useEffect, useReducer, useState } from 'react';
import { create } from 'ipfs-http-client';
import CreateSociety from './components/create-society/create-society.component';
import Memberships from './components/membership/membership.component';
import FileSystem from './components/fs/fs.component';
import SharedData from './components/shared/shared.component';


import { Sidebar, Menu, MenuItem } from 'react-pro-sidebar';
import TruncatedDisplay from './components/common/truncate-display.component';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import GitHubIcon from '@mui/icons-material/GitHub';
import WebIcon from '@mui/icons-material/Web';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDiscord } from '@fortawesome/free-brands-svg-icons';


// TODO: use extension to get account
// https://polkadot.js.org/docs/extension/usage/
function App() {
  // make sure the wasm blob is loaded
  useWasm();

  const [ignored, forceUpdate] = useReducer(x => x + 1, 0);

  const [ipfs, setIpfs] = useState(null);
  const [api, setApi] = useState(null);

  const [acct, setAcct] = useState(null);
  const [addr, setAddr] = useState('');
  const [signer, setSigner] = useState(null);

  const [newIpfsPort, setNewIpfsPort] = useState('5001');
  const [newIpfsHost, setNewIpfsHost] = useState('127.0.0.1');

  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('9944');

  const [ipfsPort, setIpfsPort] = useState('443');
  const [ipfsHost, setIpfsHost] = useState('ipfs.idealabs.network');
  const [uri, setUri] = useState('');

  useEffect(() => {
    // let provider = new WsProvider(`ws://${host}:${port}`);
    let provider = new WsProvider(`wss://cryptex.idealabs.network:443`);
    const setup = async () => {
      // setup api for blockchain
      const api = await ApiPromise.create({
        provider,
        types: {
          SocietyId: "Bytes",
        }
      });
      await api.isReady;
      setApi(api);
      await setupIpfs();
      // load ALICE account
      const keyring = new Keyring({ type: 'sr25519' });
      // let uriAcct = keyring.addFromUri(uri);
      // returns an array of all the injected sources
      // (this needs to be called first, before other requests)
      await web3Enable('Enigma');
      // returns an array of { address, meta: { name, source } }
      // meta.source contains the name of the extension that provides this account
      const allAccounts = await web3Accounts();
      let address = allAccounts[0].address;
      setAddr(address);
      // finds an injector for an address
      const injector = await web3FromAddress(address);
      setSigner(injector.signer);
      let acct = keyring.addFromAddress(address);
      setAcct(acct);
      await initEventListener(api, acct);
      await blockListener(api);
    }
    setup();
  }, [uri]);

  const setupIpfs = async() => {
    console.log('Establishing a connection to IPFS');
    const ipfs = await create({
      host: ipfsHost,
      port: ipfsPort,
      protocol: 'https',
    });
    let id = await ipfs.id();
    console.log(id);
    if (id !== null) {
        setIpfs(ipfs);
        // setIpfsReady(true);
    } else {
      console.log('ipfs unavailable');
    }
  }
  
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

  const HomePage = () => {
    return (
      <div className='home'>
        <div>
          <h2>Welcome!</h2>
        </div>
        <p>Engima is an experimental, decentralized, multi-party *communication* dapp that lets you and your peers collectively secure and authorize access to data.</p>
        <WarningAmberIcon /> <span>This project is under development (and not mobile friendly). Current messages to be encrypted are <b>limited to 32-bit strings</b>.</span>
        <br></br>
        <h3>Securely share data with your peers</h3>
        <p>Enigma is a tool that lets you securely share data with your peers. It uses a distributed key generation mechanism to create a shared secret key that only members of the group can decrypt. This means that your data is protected from anyone who is not a member of the group, even if they have access to the encrypted data.</p>
        <h1>
          Getting Started
        </h1>
        <div className='instructions'> 
          <span>
            1. Install the <a target="_blank" href='https://polkadot.js.org/extension/'>polkadotjs extension</a> and create a new account, or use your existing account
          </span>
          <span>
            2. Paste your address in our <a target='_blank' href='https://discord.com/channels/920374925984927744/1110259632250835015'>Discord</a> to request some tokens. We are working on automating this process but it's manual for now.
          </span>
          <span>
            3. Use the tabs on the left to create/manage societies and secrets.
          </span>
          <span>
            4. Check out our <a target='_blank' href="https://github.com/ideal-lab5">github</a> to stay up to date on development or to learn how to get more involved. This is an open source project that has been built with passion but without funding or other support. If you'd like to invest in the project or collaborate, send me a message at driemworks@idealabs.network, or share a message with me on Enigma at 5GGrFp7o5b5CMSi9uZnkveRusegbVgVUa5BvqXRQHsJ9SSjc. 
          </span>
        </div>
        <h3>How it works</h3>
        <h4>Create or Join a Society</h4>
        <p>To begin, you can either create a new society or join an existing one. A society is a group of individuals who have gone through the distributed keypair generation (DKG) process together. Each society has a public key that serves as an encryption key for data sharing.
        </p>
        <h4>Encrypt and Publish Data</h4>
        <p>Once you're part of a society, you can encrypt your data using the society's public key directly in your browser. This ensures that your data remains secure during transmission. After encryption, you can add the encrypted data to IPFS (InterPlanetary File System) and submit a signed transaction with the resulting Content Identifier (CID). This process guarantees the authenticity and integrity of your data.
        </p>
        <h4>Share Secrets with Trusted Contacts</h4>
        <p>Enigma allows you to selectively share pieces of the secret key with specific addresses in the network. When you share your piece of the secret with another address, it enhances collaboration and enables that address to decrypt the shared secret. However, to maintain a high level of security, a threshold of members must share with the same address before decryption is possible.
        </p>
        <h4>Collaborate and Access Shared Secrets</h4>
        <p>As a member of a society, you have the opportunity to collaborate and access shared secrets from other trusted members. When a threshold of members has shared their secret with your address, you gain the ability to decrypt the shared secret and unlock its contents.
        </p>
      </div>
    );
  }

  const [activeComponentName, setActiveComponentName] = useState('');
  const [ActiveComponent, setActiveComponent] = useState(<HomePage />);

  const handleSetDisplay = (componentName) => {
    setActiveComponentName(componentName);
    if (componentName === 'create') {
      setActiveComponent(
        <CreateSociety
          api={api} acct={acct} addr={addr} signer={signer}
        />);
    } else if (componentName === 'memberships') {
      setActiveComponent(<Memberships 
        api={api} 
        acct={acct} 
        ipfs={ipfs}
        addr={addr} signer={signer}
      />);
    } else if (componentName === 'filesystem') {
      setActiveComponent(
        <FileSystem 
          api={api} acct={acct} 
          addr={addr} signer={signer}
        />);
    } else if (componentName === 'shared') {
      setActiveComponent(
        <SharedData 
          acct={acct} api={api} ipfs={ipfs} 
          addr={addr} signer={signer}
        />);
    } else {
      setActiveComponent(<div>Well, this should not have happened...</div>);
    }
  }

  return (
    <div className="App">
      <div className='header'>
        {/* <div className='ipfs-config'>
          <Box sx={{ 
            width: 500, flexShrink: 0, borderBottom: 1, borderColor: 'divider', backgroundColor: 'primary.secondary', }}>
              <TextField 
                label="ipfs port" 
                id='ipfsPort' 
                type="number" 
                value={newIpfsPort} 
                onChange={e => { setNewIpfsPort(e.target.value) }}
              />
              <TextField 
                label="ipfs host" 
                id='ipfsHost' 
                type="text" 
                value={newIpfsHost} 
                onChange={e => { 
                  setNewIpfsHost(e.target.value);
                }}
              />
              <Button onClick={() => {
                if (newIpfsPort !== '' && newIpfsHost !== '') {
                  setIpfsPort(newIpfsPort);
                  setIpfsHost(newIpfsHost);
                  setupIpfs();
                  forceUpdate();
                }
              }}>Enter</Button>
            </Box>
        </div> */}
        <div className='title'>
          <h2 onClick={() => setActiveComponent(<HomePage />)}>
            Enigma
          </h2>
        </div>
        <div className='header-details'>
          <span>
            Api is { api === null ? 'not' : '' } ready
          </span>
          <span>
            Ipfs is { ipfs === null ? 'not' : '' } ready
          </span>
          { addr === '' ? <div>No wallet detected</div> :
          <TruncatedDisplay data={addr} message="Address: " /> }
        </div>
      </div>
      <div className='body'><div className='content'>
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
      </div>
      <div className='footer'>
          <a target='_blank' href="https://github.com/ideal-lab5"><GitHubIcon /></a>
          <a target='_blank' href='https://idealabs.network/'><WebIcon /></a>
          <a className='discord' target='_blank' href='https://discord.com/channels/920374925984927744/920382293896462417'><FontAwesomeIcon icon={faDiscord} /></a>
        </div>
    </div>
  );
}

export default App;
 