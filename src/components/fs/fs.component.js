import { useEffect, useState } from "react";
import { calculate_secret } from "dkg-wasm";

import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { Box, Button, TextField } from "@mui/material";

import TruncatedDisplay from "../common/truncate-display.component";

const FileSystem = (props) => {

    const [selectedSociety, setSelectedSociety] = useState('');
    const [files, setFiles] = useState([]);
    const [activeIds, setActiveIds] = useState([]);

    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
      if (props.api !== null && props.addr !== undefined) {
        activeSocietyListener();
      }
    }, [props.api]);

    const handleQueryFs = async () => {
      let fs = await props.api.query.society.fs(selectedSociety);
      setFiles(fs);
    }

    const activeSocietyListener = async () => {
      let ids = await props.api.query.society.membership(props.addr, "active");
      setActiveIds(ids);
    }

    const Reencrypt = (props) => {
      const [recipient, setRecipient] = useState('');

      const handleSubmitReencryptionKeys = async(hash) => {
        setIsLoading(true);
        // calculate your secret
        let localId = selectedSociety + ':' + props.acct.address;
        let poly = JSON.parse(localStorage.getItem(localId));
        let secret = calculate_secret(poly.coeffs);
        // TODO: encrypt the secret
        console.log(props.addr);
        props.api.tx.society.submitReencryptionKey(
            selectedSociety, recipient, hash, secret,
        ).signAndSend(props.addr, {signer: props.signer}, result => {
            if (result.isInBlock) {
              setIsLoading(false);
            }
        });
    }

      return (
        <Box>
          <TextField
            id="recipient" 
            label="recipient" 
            variant="standard" 
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
          <Button onClick={() => handleSubmitReencryptionKeys(props.hash)}>Submit</Button>
        </Box>
      );
    }

    return (
      <div className='section fs'>
        <label htmlFor='society-input'>Set society id</label>
        <input 
          id="society-input" 
          type="text" 
          value={selectedSociety} 
          onChange={e => setSelectedSociety(e.target.value)} />
        <button onClick={handleQueryFs}>Search</button>
        { isLoading === true ? 
        <div>
            <span>Submitting reencryption key</span>
        </div> :
        <TableContainer component={Paper}>
         <Table sx={{ minWidth: 650 }} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Author</TableCell>
              <TableCell align="right">Hash</TableCell>
              <TableCell align="right">CID</TableCell>
              { activeIds.indexOf(selectedSociety) > -1 ?
              <TableCell align="right">Reencrypt (address)</TableCell>
              : <TableCell align="right"> - </TableCell>
              }
            </TableRow>
          </TableHead>
          <TableBody>
            {files.map((file) => {
              // console.log(file[0]);
              let hash = file[0].hash_.toString();
              return (<TableRow
                key={hash}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  <TruncatedDisplay data={JSON.parse(file[0]).author} message='' />
                </TableCell>
                <TableCell>
                  <TruncatedDisplay data={hash} message='' />
                </TableCell>
                <TableCell>
                <TruncatedDisplay data={file[1].toHuman()} message='' />
                </TableCell>
                <TableCell align="right">
                { activeIds.indexOf(selectedSociety) > -1 ?
                  <Reencrypt
                    acct={props.acct} api={props.api} hash={hash}
                    addr={props.addr} signer={props.signer}
                  />
                  : <div></div>}
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

export default FileSystem;