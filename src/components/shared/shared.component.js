/* global BigInt */
import { useEffect, useReducer, useState } from "react";
import { CID } from 'ipfs-http-client';
import { combine_secrets, threshold_decrypt } from 'dkg-wasm';
import { hexToU8a } from '@polkadot/util'; 

import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { Box, Button, TextField } from "@mui/material";
import TruncatedDisplay from "../common/truncate-display.component";

const SharedData = (props) => {

  const [sharedKeys, setSharedKeys] = useState(new Map());
  const [ignored, forceUpdate] = useReducer(x => x + 1, 0);

  useEffect(() => {
    handleQueryReencryptionKeys();
  }, []);

  const handleQueryReencryptionKeys = async() => {
    let entries = await props.api.query.society.reencryptionKeys(props.acct.address);
    entries.forEach(async entry => {
      let society_id = entry.toHuman()[1];
      let hash = entry.toHuman()[2];
      let rk = entry.toHuman()[3];
      let files = await props.api.query.society.fs(society_id);
      let target = null;
      files.forEach(async file => {
        if (file[0].hash_.toString() === hash) {
          target = file;
          let cid = String.fromCharCode(...target[1]);
          let society = await props.api.query.society.societies(society_id);
          let threshold = society.toHuman().threshold;
          let keys = {
            u: target[0].u,
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
        } 
      });
      
    });
  }

  const Decrypt = (props) => {

    const [decryptedMessage, setDecryptedMessage] = useState('');

    const handleDecrypt = async(id, hash_) => {
      let r2 = 48484;
      // get u and w values from Fs
      // let files = await props.api.query.society.fs(id);
      // let target = files.find(f => f.hash_ == hash_);
      // fetch ciphertext by CID
      let result = await props.ipfs.cat(CID.parse(props.cid));
      let ct;
      for await (const item of result) {
          ct = item;
      }
      let gsk = props.rks.map(sk => hexToU8a(sk)).reduce((a, b) => combine_secrets(a, b));
      let plaintext = threshold_decrypt(BigInt(r2), ct, props.u, gsk);
      // need to use a different char than 0... TODO
      let msg = String.fromCharCode(...plaintext);
      msg = msg.slice(0, msg.indexOf(0));
      setDecryptedMessage(msg);
    }

    return (
      <div>
        { props.k.length < props.k[0].threshold ?
          <div>
            <span>Insufficient shares for decryption ({props.k.length} of {props.k[0].threshold})</span>
          </div> :
          <div className="message-container">
            <Button onClick={() => handleDecrypt(
              props.k[0].society_id, props.hash, props.k[0].cid)
            }> Decrypt
            </Button>
            { decryptedMessage }
          </div>
          }
      </div>
    );
  }

  return (
    <div className="section">
      { sharedKeys.length === 0 ? <div></div> :
        <TableContainer component={Paper}>
         <Table sx={{ minWidth: 500 }} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Society</TableCell>
              <TableCell align="left">Hash</TableCell>
              <TableCell align="left">CID</TableCell>
              <TableCell align="left">Threshold</TableCell>
              <TableCell align="left">Decrypt</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
          { [...sharedKeys.keys()].map((hash, i) => {
            let k = sharedKeys.get(hash);
            let rks = k.map(j => j.rk).filter(k => k != undefined);
            return (<TableRow
              key={i}
              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
            >
              <TableCell>{ k[0].society_id }</TableCell>
              <TableCell>
                <TruncatedDisplay data={hash} message='' />
              </TableCell>
              <TableCell>
                <TruncatedDisplay data={k[0].cid} message='' />
              </TableCell>
              <TableCell>{k[0].threshold}</TableCell>
              <TableCell>
                <Decrypt
                  api={props.api} hash={hash} k={k} 
                  ipfs={props.ipfs} rks={rks} 
                  cid={k[0].cid} u={k[0].u}
                />
              </TableCell>
            </TableRow>);
          })}
          </TableBody>
        </Table>
      </TableContainer>
      }
    </div>
  );
}

export default SharedData;