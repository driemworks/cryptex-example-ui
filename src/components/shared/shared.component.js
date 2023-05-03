/* global BigInt */
import { useReducer, useState } from "react";
import { CID } from 'ipfs-http-client';
import { combine_secrets, threshold_decrypt } from 'dkg-wasm';
import { hexToU8a } from '@polkadot/util'; 

const SharedData = (props) => {

  const [decryptedMessage, setDecryptedMessage] = useState('');
  const [sharedKeys, setSharedKeys] = useState(new Map());

  const [ignored, forceUpdate] = useReducer(x => x + 1, 0);

  const handleDecrypt = async(id, hash_, cid, sks) => {
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
    let gsk = sks.map(sk => hexToU8a(sk)).reduce((a, b) => combine_secrets(a, b));
    let plaintext = threshold_decrypt(BigInt(r2), ct, target.u, gsk);
    setDecryptedMessage(String.fromCharCode(...plaintext));
  }


  const handleQuerySociety = async(id) => {
    let society = await props.api.query.society.societies(id);
    return society;
  }  

  const handleQueryReencryptionKeys = async() => {
    let entries = await props.api.query.society.reencryptionKeys(props.acct.address);
    // console.log(entries);
    entries.forEach(async entry => {
      // console.log('entry');
      // console.log(entry.toHuman());
      let hash = entry.toHuman()[1];
      let rk = entry.toHuman()[2];
      let cid = localStorage.getItem(hash.toString());
      let society_id = localStorage.getItem(cid);
      let society = await handleQuerySociety(society_id);
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
            console.log('rks ' + rks);
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
                      <span>Insufficient shares for decryption ({k.length} of {k[0].threshold})</span>
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

export default SharedData;