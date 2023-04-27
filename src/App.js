/* global BigInt */
import './App.css';
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { 
    keygen, calculate_secret, calculate_shares_and_commitments,
    calculate_pubkey, sign, verify, 
    combine_pubkeys, combine_secrets, 
    encrypt, threshold_decrypt,
} from "dkg-wasm";
import { useWasm } from './useWasm';
import { useEffect, useState } from 'react';

function App() {
  // make sure the wasm blob is loaded
  useWasm();

  const [api, setApi] = useState(null);
  const [acct, setAcct] = useState(null);
  const [invitations, setInvitiations] = useState([]);
  const [committed, setCommitted] = useState([]);
  const [activeMemberships, setActiveMemberships] = useState([]);

  useEffect(() => {
    const host = "127.0.0.1";
    const port = "9944";
    let provider = new WsProvider(`ws://${host}:${port}`);
    const setup = async () => {
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
    }
    setup();
  }, []);

  useEffect(() => {
    if (api !== null) {
      updateMembershipMaps(api, acct);
    }
  }, [acct]);


  const updateMembershipMaps = (api, acct) => {
    setInvitiations([]);
    setCommitted([]);
    setActiveMemberships([]);

    queryActiveMembership(api, acct);
    queryCommitted(api, acct);
    queryInvites(api, acct);
  }

  const queryInvites = async (api, acct) => {
    let my_invitations = await api.query.society.membership(acct.address, "invitee");
    my_invitations.forEach(async id => {
      let society = await handleQuerySociety(api, id);
      let statusArray = await handleQuerySocietyStatus(api, id);
      let latest = statusArray[statusArray.length - 1][1].toHuman();
      setInvitiations([...invitations, {
        id: id,
        society: society,
        status: latest,
      }]);
    }); 
  }

  const queryCommitted = async (api, acct) => {
    let my_invitations = await api.query.society.membership(acct.address, "committed");
    my_invitations.forEach(async id => {
      let society = await handleQuerySociety(api, id);
      let statusArray = await handleQuerySocietyStatus(api, id);
      let latest = statusArray[statusArray.length - 1][1].toHuman();
      setCommitted([...invitations, {
        id: id,
        society: society,
        status: latest,
      }]);
    }); 
  }

  const queryActiveMembership = async (api, acct) => {
    let activeMembershipsResults = await api.query.society.membership(acct.address, "active");
    activeMembershipsResults.forEach(async id => {
      let societyDetails = await handleQuerySociety(api, id);
      let statusArray = await handleQuerySocietyStatus(api, id);
      let latest = statusArray[statusArray.length - 1][1].toHuman();
      setActiveMemberships([...activeMemberships, {
        id: id,
        society: societyDetails,
        status: latest,
      }]);
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
      // setDisplayText([...displayText, 'Calculated public key']);
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
      )
      .signAndSend(acct, ({ status, events }) => {
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
      // .signAndSend(acct, result => {
      //   if (result) {
      //     console.log(JSON.stringify(result.toHuman()));
      //   }
      //   if (result.isFinalized) {
      //     setDisplayText([...displayText, 'Tx finalized']);
      //     updateMembershipMaps(api, acct);
      //     setDisplayText('');
      //     setIsLoading(false);
      //   }
      // });
    }

    // const handleCalculateSocietyPubkey = async (id) => {
    //   // retrieve all published pubkeys and combine them
    //   // these pubkeys are in G2...
    //   let pubkeys = await api.query.society.rsvp(id);
    //   let gpk = pubkeys.toHuman()
    //     .reduce((a, b) => 
    //       combine_pubkeys(a[1], b[1]));
    //     console.log(gpk);
    //   // TODO: maybe store in localstorage?
    //   setGpkMap(new Map(gpkMap.set(id, gpk)));
    // }


  // const calculateGroupSecretKey = () => {
  //   return society.reduce((a, b) => combine_secrets(a.secret, b.secret));
  // }

    const handlePublishMessage = async (id) => {
      // the 'seed', random
      let seed = 23;
      // arbitrary
      let r1 = 123123;
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
      // let gpk = gpkMap.get(id);
      // let msg = new TextEncoder().encode(message);
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
      console.log(msg.length);
      let ciphertext = encrypt(BigInt(seed), BigInt(r1), msg, gpk.g2);
      console.log(ciphertext);
      api.tx.society.publish(
        id, 
        ciphertext.v, 
        ciphertext.u, 
        ciphertext.w,
      ).signAndSend(acct, result => {
        if (result.isInBlock) {
          console.log('all good');
        }
        if (result.isFinalized) {
          console.log('the tx is finalized');
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
              </div>
          </li>);
          }) }
          </ul>
        </div>
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
        </div>
        <div className='section'>
          <CreateSociety />
        </div>
      </div>
    </div>
  );
}

export default App;
