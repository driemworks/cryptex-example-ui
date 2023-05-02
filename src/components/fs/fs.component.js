import { useState } from "react";
import { calculate_secret } from "dkg-wasm";

const FileSystem = (props) => {

    const [selectedSociety, setSelectedSociety] = useState('');
    const [files, setFiles] = useState([]);
    const [recipient, setRecipient] = useState('');

    const [isLoading, setIsLoading] = useState(false);

    const handleSubmitReencryptionKeys = async(hash) => {
        setIsLoading(true);
        // calculate your secret
        let localId = selectedSociety + ':' + props.acct.address;
        console.log('local id ' +  localId)
        let poly = JSON.parse(localStorage.getItem(localId));
        let secret = calculate_secret(poly.coeffs);
        console.log('the secret is ' + secret);
        // TODO: encrypt the secret
        props.api.tx.society.submitReencryptionKey(
            selectedSociety, recipient, hash, secret,
        ).signAndSend(props.acct, result => {
            if (result.isFinalized) {
              setIsLoading(false);
            }
        });
    }
    
    const handleQueryFs = async () => {
      let fs = await props.api.query.society.fs(selectedSociety);
      setFiles(fs);
    }

    return (
      <div className='section fs'>
        <label htmlFor='society-input'>Set society id</label>
        <input id="society-input" type="text" value={selectedSociety} onChange={e => setSelectedSociety(e.target.value)} />
        <button onClick={handleQueryFs}>Search</button>
        { isLoading === true ? 
        <div>
            <span>Submitting keys...</span>
        </div> :
        <ul>
          { files.map((f, i) => {
            return (
              <li key={i}>
                <div className='section'>
                  <span>Author { JSON.parse(f).author }</span>
                  <span>hash { JSON.parse(f).hash }</span>
                  <div className='section'>
                    <label>To</label>
                    <input type="text" 
                      value={recipient} 
                      onChange={e => setRecipient(e.target.value)} />
                    <button onClick={() => handleSubmitReencryptionKeys(JSON.parse(f).hash)}>
                      Distribute keys
                    </button>
                  </div>
                  
                </div>
              </li>
            )
          }) }
        </ul>
        }
      </div>
    );
}

export default FileSystem;