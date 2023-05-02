/* global BigInt */
import './App.css';
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { hexToU8a } from "@polkadot/util";
import { 
    keygen, calculate_secret, calculate_shares_and_commitments,
    calculate_pubkey, sign, verify, 
    combine_pubkeys, combine_secrets, 
    encrypt, threshold_decrypt,
} from "dkg-wasm";
import { useWasm } from './useWasm';
import { useEffect, useReducer, useState } from 'react';
import { create, CID } from 'ipfs-http-client';
import CreateSociety from './components/create-society/create-society.component';
import Memberships from './components/membership/membership.component';
import FileSystem from './components/fs/fs.component';
// TODO: use extension to get account
// https://polkadot.js.org/docs/extension/usage/
function App() {
  // make sure the wasm blob is loaded
  useWasm();

  const [ipfs, setIpfs] = useState(null);
  const [api, setApi] = useState(null);
  const [acct, setAcct] = useState(null);

  const [sharedKeys, setSharedKeys] = useState(new Map());

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

  const handleQuerySociety = async(api, id) => {
    let society = await api.query.society.societies(id);
    return society;
  }
  const [ignored, forceUpdate] = useReducer(x => x + 1, 0);

  const handleQueryReencryptionKeys = async() => {
    let entries = await api.query.society.reencryptionKeys(acct.address);
    entries.forEach(async entry => {
      let hash = entry.toHuman()[1];
      let rk = entry.toHuman()[2];
      let cid = localStorage.getItem(hash.toString());
      let society_id = localStorage.getItem(cid);
      let society = await handleQuerySociety(api, society_id);
      let threshold = society.toHuman().threshold;
      let keys = {
        cid: cid,
        threshold: threshold,
        society_id: society_id,
        rk: rk,
      };
      let shared = sharedKeys;
      if (!shared.has(hash)) {
        shared.set(hash, [keys]);
      } else {
        let s = shared.get(hash);
        shared.set(hash, [...s, keys]);
      }
      setSharedKeys(shared);
      forceUpdate();
    });
  }

  const SharedData = () => {

    const [decryptedMessage, setDecryptedMessage] = useState('');

    const handleDecrypt = async(id, hash_, cid, sks) => {
      let r2 = 48484;
      // fetch ciphertext by CID
      let result = await ipfs.cat(CID.parse(cid));
      let ct;
      for await (const item of result) {
         ct = item;
      }
      // get u and w values from Fs
      let files = await api.query.society.fs(id);
      let target = files.find(f => f.hash_ == hash_);
      // calcualate secret key
      let gsk = sks.reduce((a, b) => combine_secrets(a, b));
      if (sks.length === 1) {
        gsk = hexToU8a(gsk);
      }
      console.log(gsk);
      let plaintext = threshold_decrypt(BigInt(r2), ct, target.u, gsk);
      setDecryptedMessage(String.fromCharCode(...plaintext));
    }

    return (
      <div className='section'>
        <span>Shared Data</span>
        <div className='container'>
          <button onClick={handleQueryReencryptionKeys}>click me</button>
          <ul>
            { [...sharedKeys.keys()].map((hash, i) => {
              let k = sharedKeys.get(hash);
              let rks = k.map(j => j.rk).filter(k => k != undefined);
              console.log(rks);
              return (
                <li key={i}>
                  <div className='section'>
                    { hash }
                    {/* {JSON.stringify(k)} */}
                    <span>Society { k[0].society_id }</span>
                    <span>CID {k[0].cid}</span>
                    <span>Threshold { k[0].threshold }</span>
                    { k.length < k[0].threshold ?
                      <div>
                        <span>Insufficient shares for decryption `{k.length} of {k[0].threshold}`</span>
                      </div> :
                      <div>
                        <button onClick={() => handleDecrypt(
                          k[0].society_id, hash, k[0].cid, rks)}>
                          Decrypt
                        </button>
                        { decryptedMessage }
                      </div>
                      }
                  </div>
                </li>
              )
            }) }
          </ul>
        </div>
      </div>
    );
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
        <SharedData />
        </div>
      </div>
    </div>
  );
}

export default App;
