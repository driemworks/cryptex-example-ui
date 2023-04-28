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
import { useEffect, useState } from 'react';
import { create, CID } from 'ipfs-http-client';

function App() {
  // make sure the wasm blob is loaded
  useWasm();

  const [ipfs, setIpfs] = useState(null);
  const [api, setApi] = useState(null);
  const [acct, setAcct] = useState(null);
  const [invitations, setInvitiations] = useState([]);
  const [committed, setCommitted] = useState([]);
  const [activeMemberships, setActiveMemberships] = useState([]);

  const [selectedSociety, setSelectedSociety] = useState('');
  const [files, setFiles] = useState([]);
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
    console.log(id);
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
      updateMembershipMaps(api, aliceAcct);
    }
    setup();
  }, []);

  // useEffect(() => {
  //   if (api !== null) {
  //     updateMembershipMaps(api, acct);
  //   }
  // }, [api]);


  const updateMembershipMaps = async (api, acct) => {
    setInvitiations([]);
    setCommitted([]);
    setActiveMemberships([]);

    await queryActiveMembership(api, acct);
    await queryCommitted(api, acct);
    await queryInvites(api, acct);
  }

  const queryInvites = async (api, acct) => {
    let my_invitations = await api.query.society.membership(acct.address, "invitee");
    my_invitations.forEach(async id => {
      let society = await handleQuerySociety(api, id);
      let statusArray = await handleQuerySocietyStatus(api, id);
      let latest = statusArray[statusArray.length - 1][1].toHuman();
      let invite = {
        id: id,
        society: society,
        status: latest,
      };
      // if (!invitations.contains(invite)) {
        setInvitiations([...invitations, invite]);
      // }
    }); 
  }

  const queryCommitted = async (api, acct) => {
    let my_invitations = await api.query.society.membership(acct.address, "committed");
    my_invitations.forEach(async id => {
      let society = await handleQuerySociety(api, id);
      let statusArray = await handleQuerySocietyStatus(api, id);
      let latest = statusArray[statusArray.length - 1][1].toHuman();
      let comm = {
        id: id,
        society: society,
        status: latest,
      };
      // if (!committed.contains(comm)) {
        setCommitted([...committed, comm]);
      // }
    }); 
  }

  const queryActiveMembership = async (api, acct) => {
    let activeMembershipsResults = await api.query.society.membership(acct.address, "active");
    activeMembershipsResults.forEach(async id => {
      let societyDetails = await handleQuerySociety(api, id);
      let statusArray = await handleQuerySocietyStatus(api, id);
      let latest = statusArray[statusArray.length - 1][1].toHuman();
      let active = {
        id: id,
        society: societyDetails,
        status: latest,
      };
      // if (activeMemberships.indexOf(active) === -1) {
        setActiveMemberships([...activeMemberships, active]);
      // }
    });
  }

  const handleQuerySociety = async(api, id) => {
    let society = await api.query.society.societies(id);
    return society;
  }

  const handleQuerySocietyStatus = async(api, id) => {
    let status = await api.query.society.societyStatus(id);
    return status;
  }

  const handleQueryFs = async (id) => {
    let fs = await api.query.society.fs(id);
    setSelectedSociety(id);
    setFiles(fs);
  }

  const handleQueryReencryptionKeys = async() => {
    let entries = await api.query.society.reencryptionKeys(acct.address);
    // let flatHashes = hashes.map(({ args: [_, hash] }) => hexToU8a(hash.toHuman()));
    // console.log(`hashes: ${flatHashes}`);
    entries.forEach(async entry => {
      let hash = entry.toHuman()[1];
      let rk = entry.toHuman()[2];
      console.log(hash);
    //   // let _h = hash.map(({ args: [_, h] }) => h);
    //   // console.log(_h);
    //   let rks = await api.query.society.reencryptionKeys(acct.address, hash);
    //   console.log(rks);
      let cid = localStorage.getItem(hash.toString());
      let society_id = localStorage.getItem(cid);
      let society = await handleQuerySociety(api, society_id);
      let threshold = society.toHuman().threshold;
      console.log('threshold ' +threshold);
      // want to get the threshold value for the specific society as well
      // so that it can be determined if decryptable
      // (hash, cid, society_id, threshold, rks)
      setSharedKeys(new Map(sharedKeys.set(hash, [...sharedKeys, {
        cid: cid,
        threshold: threshold,
        society_id: society_id,
        rk: rk,
      }])));
      // setSharedKeys([...sharedKeys, ]);
    });
  }

  // const handleSubmitSignature = async(seed, id, r) => {
  //   // sign message
  //   let poly = JSON.parse(localStorage.getItem(id));
  //   let sk = calculate_secret(poly.coeffs);
  //   let message = "test";
  //   let encodedMessage = new TextEncoder().encode(message);
  //   let signature = sign(BigInt(seed), encodedMessage, sk, BigInt(r));
  //   console.log(signature);
  //   // submit to chain
  //   api.tx.society.submitSignature(
  //     id, signature.prover_response, signature.verifier_challenge,
  //   ).signAndSend(acct, result => {
  //     if (result.isInBlock) {
  //       console.log('it worked');
  //     } 
  //     if (result.isFinalized) {
  //       console.log('nice');
  //     }
  //   });
  // }

  const Memberships = () => {

    const [isLoading, setIsLoading] = useState(false);
    const [displayText, setDisplayText] = useState(['']);
    // a message to encrypt and publish (using gpk)
    const [message, setMessage] = useState('');

    const handleKeygen = (id, threshold, size, r) => {
      setIsLoading(true);
      setDisplayText([...displayText, 'Generating secrets']);
      let poly = keygen(BigInt(r), threshold);
      let localId = id + ':' + acct.address;
      localStorage.setItem(localId, JSON.stringify(poly));
      setDisplayText([...displayText, 'Calculating shares and commitments']);
      let sharesAndCommitments = calculate_shares_and_commitments(
        threshold, size, BigInt(r), poly.coeffs,
      );
      setDisplayText([...displayText, 'Submitting signed tx']);
      api.tx.society.commit(
        id, sharesAndCommitments,
      ).signAndSend(acct, result => {
        if (result.isFinalized) {
          setDisplayText([...displayText, 'Tx finalized']);
          updateMembershipMaps(api, acct);
          setDisplayText('');
          setIsLoading(false);
        }
      });
    }

    const handleJoin = (id) => {
      setIsLoading(true);
      setDisplayText([...displayText, 'Recovering secrets']);
      // console.log(JSON.stringify(polys));
      let localId = id + ':' + acct.address;
      let poly = JSON.parse(localStorage.getItem(localId));
      // TODO: these vals should be encoded in the society?
      let r1 = 45432;
      let r2 = 48484;
      let secret = calculate_secret(poly.coeffs);
      setDisplayText([...displayText, 'Calculating pubkey']);
      let pubkey = calculate_pubkey(BigInt(r1), BigInt(r2), secret);
      setDisplayText([...displayText, 'Submitting signed tx']);
      api.tx.society.join(
        id, pubkey.g1, pubkey.g2,
      ).signAndSend(acct, ({ status, events }) => {
        if (status.isInBlock || status.isFinalized) {
          updateMembershipMaps(api, acct);
          setDisplayText('');
          setIsLoading(false);
          events
            // find/filter for failed events
            .filter(({ event }) =>
              api.events.system.ExtrinsicFailed.is(event)
            )
            // we know that data for system.ExtrinsicFailed is
            // (DispatchError, DispatchInfo)
            .forEach(({ event: { data: [error, info] } }) => {
              if (error.isModule) {
                // for module errors, we have the section indexed, lookup
                const decoded = api.registry.findMetaError(error.asModule);
                const { docs, method, section } = decoded;
    
                console.log(`${section}.${method}: ${docs.join(' ')}`);
              } else {
                // Other, CannotLookup, BadOrigin, no extra info
                console.log(error.toString());
              }
            });
        }
      });
    }
  // const calculateGroupSecretKey = () => {
  //   return society.reduce((a, b) => combine_secrets(a.secret, b.secret));
  // }

    const handlePublishMessage = async (id) => {
      // the 'seed', random
      let seed = 23;
      // arbitrary
      let r1 = 45432;
      // how can I convert this to my  'SerializablePublicKey"?
      let pubkeys = await api.query.society.pubkeys(id);
      // each one is (author, pkg1, pkg2)
      let gpk;
      if (pubkeys.length === 1) {
        gpk = {
          g1: pubkeys[0][1],
          g2: pubkeys[0][2],
        };
      } else {
        gpk = pubkeys.toHuman()
          .reduce((a, b) => 
            combine_pubkeys(
              { g1: a[1], g2: a[2] }, 
              { g1: b[1], g2: b[2] })
            );
      }
      let msg = message;
      if (msg.length > 32) {
        console.log('message too long');
        return;
      } else if (msg.length < 32) {
        let max = 32 - msg.length;
        // pad the message to 32 bytes
        for (let i = 0; i < max; i++) {
          msg += "0";
        }
      }
      console.log('your message as bytes');
      console.log(new TextEncoder().encode(msg));
      let ciphertext = encrypt(BigInt(seed), BigInt(r1), msg, gpk.g2);
      console.log('your ciphertext as bytes');
      console.log(ciphertext.v);
      let { cid } = await ipfs.add(ciphertext.v);
      api.tx.society.publish(
        id, 
        ciphertext.v, 
        ciphertext.u,
        ciphertext.w,
        r1,
      ).signAndSend(acct, ({ status, events }) => {
        if (status.isInBlock || status.isFinalized) {
          // an event will contain the hash..
          events.forEach(e => {
            let readableEvent = e.event.toHuman();
            if (readableEvent.method === 'PublishedData') {
              let hash = e.event.data[0];
              // now we want to store the association of the hash with a CID
              // in practice, this would be done in a smart contract
              // for now, I'll just do store it in localstorage since I'm testing on one browser
              // map hash to cid
              localStorage.setItem(hash, cid);
              // map cid to a society (so we can get the threshold value later on)
              localStorage.setItem(cid, id);
            }
          });
        }
      });
    }

    return (
      <div className='membership-container'>
        { isLoading === true ? 
        <div>
          {displayText}
        </div> :
        <div>
          <div className='container'>
            <span>Invites ({invitations.length})</span>
            <ul>
            { invitations.map((item, idx) => {
              let threshold = JSON.parse(item.society).threshold;
              return (<li key={idx}>
                <div className='section'>
                  <span>
                    Society Id { item.id }
                  </span>
                  <span>
                    Founded By { JSON.parse(item.society).founder }
                  </span>
                  <span>
                    Threshold { threshold }
                  </span>
                  <span>
                    Deadline { JSON.parse(item.society).deadline }
                  </span>
                  { JSON.stringify(item.status) }
                  { item.status === "Commit" ?
                  <button onClick={() => handleKeygen(
                    item.id, threshold, 
                    JSON.parse(item.society).members.length, 23
                    )}>
                    Commit 
                  </button>
                  : 
                  <div>
                    In Phase: { JSON.stringify(item.status) }
                  </div>
                  }
                </div>
              </li>);
            }) }
            </ul>
          </div>

          <div className='container'>
            <span>Committed ({committed.length})</span>
            <ul>
            { committed.map((item, idx) => {
              let threshold = JSON.parse(item.society).threshold;
              return (<li key={idx}>
                <div className='section'>
                  <span>
                    Society Id { item.id }
                  </span>
                  <span>
                    Founded By { JSON.parse(item.society).founder }
                  </span>
                  <span>
                    Threshold { threshold }
                  </span>
                  <span>
                    Deadline { JSON.parse(item.society).deadline }
                  </span>
                  { JSON.stringify(item.status) }
                  { item.status === "Join" ?
                  <button onClick={() => handleJoin(item.id)}>
                    Join
                  </button>
                  : 
                  <div>
                    In phase: { JSON.stringify(item.status) }
                  </div>
                  }
                </div>
              </li>);
            }) }
            </ul>
          </div>

        </div>
        }
        <div className='container'>
          <span>Active ({activeMemberships.length})</span>
          <ul>
          { activeMemberships.map((s, idx) => {
            return (<li key={idx}>
              <div className='section'>
                <span>
                  id: { s.id }
                </span>
                <div>
                  <input id="message-input" type="text" placeholder='Write a message' value={message} onChange={e => setMessage(e.target.value)} />
                  <button onClick={() => handlePublishMessage(s.id)}>
                    Publish
                  </button>
                </div>
                <button onClick={() => handleQueryFs(s.id)}>
                  Show File System
                </button>
              </div>
          </li>);
          }) }
          </ul>
        </div>
      </div>
    );
  }

  const SharedData = () => {

    const handleDecrypt = async(id, hash_, cid, sks) => {
      let r2 = 48484;
      // fetch ciphertext by CID
      let result = await ipfs.cat(CID.parse(cid));
      let ct;
      for await (const item of result) {
         ct = item;
      }
      console.log(ct);
      // get u and w values from Fs
      let files = await api.query.society.fs(id);
      let target = files.find(f => f.hash_ == hash_);
      // calcualate secret key
      let gsk = sks.reduce((a, b) => combine_secrets(a, b));
      let plaintext = threshold_decrypt(BigInt(r2), ct, target.u, gsk);
      console.log('plaintext ' + plaintext);
    }

    return (
      <div className='section'>
        <span>Shared Data</span>
        <div className='container'>
          <button onClick={handleQueryReencryptionKeys}>click me</button>
          <ul>
            { [...sharedKeys.keys()].map((entry, i) => {
              let k = sharedKeys.get(entry);
              let rks = k.map(j => j.rk);
              console.log('rks ' + JSON.stringify(rks));
              return (
                <li key={i}>
                  <div className='section'>
                    { entry }
                    <span>Society { k[0].society_id }</span>
                    <span>CID {k[0].cid}</span>
                    <span>Threshold { k[0].threshold }</span>
                    { k.length < k[0].threshold ?
                      <div>
                        <span>Insufficient shares for decryption `({k.length}) of ({k[0].threshold})`</span>
                      </div> :
                      <div>
                        <button onClick={async () => handleDecrypt(k[0].society_id, entry, k[0].cid, rks)}>
                          Decrypt
                        </button>
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

  const FileSystem = () => {
    
    const [recipient, setRecipient] = useState('');

    const handleSubmitReencryptionKeys = async(hash) => {
      // calculate your secret
      let localId = selectedSociety + ':' + acct.address;
      let poly = JSON.parse(localStorage.getItem(localId));
      let secret = calculate_secret(poly.coeffs);
      // TODO: encrypt the secret
      api.tx.society.submitReencryptionKey(
        selectedSociety, recipient, hash, secret,
      ).signAndSend(acct, result => {
        if (result.isFinalized) {
          console.log('done');
        }
      });
    }

    return (
      <div className='section fs'>
        <span>Active files for {selectedSociety}</span>
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
      </div>
    );
  }

  const CreateSociety = () => {
    const [threshold, setThreshold] = useState(0);
    const [deadline, setDeadline] = useState(0);
    const [name, setName] = useState('');
    const [id, setId] = useState('');
    const [newMember, setNewMember] = useState('');
    const [members, setMembers] = useState([]);

    const [isLoading, setIsLoading] = useState(false);

    const handleCreateSociety = () => {
      setIsLoading(true);
      api.tx.society.create(
        id, threshold, name, deadline, members,
      ).signAndSend(acct, result => {
        if (result.isFinalized) {
          // will emit an event in the future
          setIsLoading(false);
          updateMembershipMaps(api, acct);
        }
      });
    }

    return (
      <div className='section'>
        <span>
          Create a Society
        </span>
        {isLoading === true ? 
        <div>
          <p>Loading...</p>
        </div> :
        <div className='form'> 
          <label htmlFor='threshold'>threshold</label>
          <input id="threshold" type="number" value={threshold} onChange={e => setThreshold(e.target.value)} />

          <label htmlFor='id'>id</label>
          <input id="id" type="text" value = {id} onChange={e => setId(e.target.value)} />

          <label htmlFor='name'>name</label>
          <input id="name" type="text" value = {name} onChange={e => setName(e.target.value)} />

          <label htmlFor='deadline'>deadline</label>
          <input id="deadline" type="number" value = {deadline} onChange={e => setDeadline(e.target.value)} />

          <label htmlFor='new-member'>add members</label>
          <input id="new-member" type="text" value={newMember} onChange={e => {
            setNewMember(e.target.value);
          }} />
          <button onClick={() => {
            let addMember = newMember;
            setMembers([...members, addMember]);
            setNewMember('');
          }}>+</button>
          <ul>
          { members.map((member, i) => {
              return (
              <li key={i}>
                <div>
                  { member }
                </div>
              </li>
              )
          })}
          </ul>
          <button onClick={handleCreateSociety}> Create Society
          </button>
        </div>
        }
      </div>
    );
  }

  return (
    <div className="App">
      <div className='header'>
        <h2>Cryptex</h2>
        <span>
          Api is { api === null ? 'not' : '' } ready
        </span>
      </div>
      <div className='body'>
        <div className='section'>
          <Memberships />
          {/* you can only see one 'file system' at a time */}
          <FileSystem />
        </div>
        <div className='section'>
          <CreateSociety />
        </div>
        <div>
        <SharedData />
        </div>
      </div>
    </div>
  );
}

export default App;
