/* global BigInt */
import { useReducer, useState } from "react";
import { CID } from 'ipfs-http-client';
import { combine_secrets, threshold_decrypt } from 'dkg-wasm';
import { hexToU8a } from '@polkadot/util'; 

const SharedData = (props) => {

  const [sharedKeys, setSharedKeys] = useState(new Map());
  const [ignored, forceUpdate] = useReducer(x => x + 1, 0);

  const handleQueryReencryptionKeys = async() => {
    let entries = await props.api.query.society.reencryptionKeys(props.acct.address);
    entries.forEach(async entry => {
      let hash = entry.toHuman()[1];
      let rk = entry.toHuman()[2];
      let cid = localStorage.getItem(hash.toString());
      let society_id = localStorage.getItem(cid);
      let society = await props.api.query.society.societies(society_id);
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

  const YourMessage = (props) => {

    const [decryptedMessage, setDecryptedMessage] = useState('');

    const handleDecrypt = async(id, hash_, cid) => {
      let r2 = 48484;
      // fetch ciphertext by CID
      let result = await props.ipfs.cat(CID.parse(cid));
      let ct;
      for await (const item of result) {
          ct = item;
      }
      // get u and w values from Fs
      let files = await props.api.query.society.fs(id);
      let target = files.find(f => f.hash_ == hash_);
      let gsk = props.rks.map(sk => hexToU8a(sk)).reduce((a, b) => combine_secrets(a, b));
      let plaintext = threshold_decrypt(BigInt(r2), ct, target.u, gsk);
      // need to use a different char than 0... TODO
      let msg = String.fromCharCode(...plaintext);
      msg = msg.slice(0, msg.indexOf(0));
      setDecryptedMessage(msg);
    }

    return (
      <div className='section'>
        { props.hash }
        <span>Society { String.fromCharCode(...hexToU8a(props.k[0].society_id)) }</span>
        <span>CID { props.k[0].cid }</span>
        <span>Threshold { props.k[0].threshold }</span>
        { props.k.length < props.k[0].threshold ?
          <div>
            <span>Insufficient shares for decryption ({props.k.length} of {props.k[0].threshold})</span>
          </div> :
          <div className="message-container">
            <button onClick={() => handleDecrypt(
              props.k[0].society_id, props.hash, props.k[0].cid)
            }> Decrypt
            </button>
            { decryptedMessage }
          </div>
          }
      </div>
    );
  }

  return (
    <div className='section'>
      <span>Shared Data</span>
      <div className='container'>
        {/* TODO: this should be called in useEffect */}
        <button onClick={handleQueryReencryptionKeys}>click me</button>
        <ul>
          { [...sharedKeys.keys()].map((hash, i) => {
            let k = sharedKeys.get(hash);
            let rks = k.map(j => j.rk).filter(k => k != undefined);
            return (
              <li key={i}>
                <YourMessage 
                  api={props.api} 
                  acct={props.acct} 
                  ipfs={props.ipfs}
                  k={k} rks={rks} hash={hash} />
              </li>
            )
          }) }
        </ul>
      </div>
    </div>
  );
}

export default SharedData;