/* global BigInt */
import { useEffect, useState } from "react";
import { 
    keygen, calculate_pubkey, combine_pubkeys,
    calculate_shares_and_commitments, calculate_secret,
    encrypt } from 'dkg-wasm';
const Memberships = (props) => {

    const [isLoading, setIsLoading] = useState(false);
    const [displayText, setDisplayText] = useState([]);

    const [inviteIds, setInviteIds] = useState([]);
    const [committedIds, setCommittedIds] = useState([]);
    const [activeIds, setActiveIds] = useState([]);

    useEffect(() => { 
      let mounted = true;
      if (props.acct !== null) {
        if (mounted === true) {
          activeSocietyListener(props.api, props.acct);
          committedSocietyListener(props.api, props.acct);
          inviteeSocietyListener(props.api, props.acct);
          mounted = false;
        }
      }
    }, [props.acct]);

  const activeSocietyListener = async (api, acct) => {
    let ids = await api.query.society.membership(acct.address, "active");
    setActiveIds(ids);
  }

  const inviteeSocietyListener = async (api, acct) => {
    let ids = await api.query.society.membership(acct.address, "invitee");
    setInviteIds(ids);
  }

  const committedSocietyListener  = async (api, acct) => {
    let ids = await api.query.society.membership(acct.address, "committed");
    setCommittedIds(ids);
  } 

  const handleQuerySociety = async(api, id) => {
    let society = await api.query.society.societies(id);
    return society;
  }

  const handleQuerySocietyStatus = async(api, id) => { 
    let status = await api.query.society.societyStatus(id);
    return status;
  }

  const handleKeygen = (id, threshold, size) => {
    let r1 = 45432;
    let r2 = 48484;
    setIsLoading(true);
    setDisplayText([...displayText, 'Generating secrets']);
    // TODO: make random
    let seed = Math.floor(Math.random() * 100000000) + 1;
    let poly = keygen(BigInt(seed), threshold);
    let localId = id.toHuman() + ':' + props.acct.address;
    localStorage.setItem(localId, JSON.stringify(poly));
    setDisplayText([...displayText, 'Calculating shares and commitments']);
    let sharesAndCommitments = calculate_shares_and_commitments(
      threshold, size, BigInt(r2), poly.coeffs,
    );
    setDisplayText([...displayText, 'Submitting signed tx']);
    props.api.tx.society.commit(
      id, sharesAndCommitments,
    ).signAndSend(props.acct, result => {
      if (result.isFinalized) {
        setDisplayText([...displayText, 'Tx finalized']);
        setDisplayText([]);
        setIsLoading(false);
      }
    });
  }

  const handleJoin = (id) => {
    setIsLoading(true);
    setDisplayText([...displayText, 'Recovering secrets']);
    let localId = id.toHuman() + ':' + props.acct.address;
    let poly = JSON.parse(localStorage.getItem(localId));
    // TODO: these vals should be encoded in the society?
    let r1 = 45432;
    let r2 = 48484;
    let secret = calculate_secret(poly.coeffs);
    setDisplayText([...displayText, 'Calculating pubkey']);
    let pubkey = calculate_pubkey(BigInt(r1), BigInt(r2), secret);
    setDisplayText([...displayText, 'Submitting signed tx']);
    props.api.tx.society.join(
      id, pubkey.g1, pubkey.g2,
    ).signAndSend(props.acct, ({ status, events }) => {
      if (status.isInBlock) {
      //   updateMembershipMaps(props.api, props.acct);
        setDisplayText([]);
        setIsLoading(false);
      }
    });
  }

  const handlePublishMessage = async (id, message) => {
    setIsLoading(true);
    setDisplayText("Encrypting data");
    // the 'seed', random
    let seed = Math.floor(Math.random() * 100000000) + 1;
    // arbitrary
    let r1 = 45432;
    // how can I convert this to my  'SerializablePublicKey"?
    let pubkeys = await props.api.query.society.pubkeys(id);
    console.log('pubkeys');
    console.log(pubkeys);
    // each one is (author, pkg1, pkg2)
    let gpk;
    if (pubkeys.length === 1) {
      gpk = {
        g1: pubkeys[0][1],
        g2: pubkeys[0][2],
      };
    } else {
      gpk = pubkeys.reduce((a, b) => 
          combine_pubkeys(
            { g1: a[1], g2: a[2] }, 
            { g1: b[1], g2: b[2] })
          );
    }
    console.log('gpk');
    console.log(gpk);
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
    let msgBytes = new TextEncoder().encode(msg)
    let ciphertext = encrypt(BigInt(seed), BigInt(r1), msgBytes, gpk.g2);
    let { cid } = await props.ipfs.add(ciphertext.v);
    setDisplayText([...displayText, "Added to ipfs with CID: " + cid]);
    setDisplayText([...displayText, "Publishing data"]);
    props.api.tx.society.publish(
      id, 
      ciphertext.v, 
      ciphertext.u,
      ciphertext.w,
      r1,
    ).signAndSend(props.acct, ({ status, events }) => {
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
            setIsLoading(false);
            setDisplayText([]);
          }
        });
      }
    });
  }

  const Invite = (props) => {
    const [invitationInfo, setInvitiationInfo] = useState([]);

    const queryInviteInfo = () => {
      Promise.all([
        handleQuerySociety(props.api, props.id),
        handleQuerySocietyStatus(props.api, props.id),
      ]).then(response => {
        let society = response[0].toHuman();
        let statusArray = response[1].toHuman();
        if (statusArray.length > 0) {
          let latest = statusArray.slice(-1);
          setInvitiationInfo({society: society, phase: latest});
        }
      });
    }

    return (
      <div>
        <button onClick={queryInviteInfo}>
          Society Id { props.id.toHuman() }
        </button>
        { invitationInfo.length === 0 ?
          <div></div>:
          <div className="section">
            <span>
              Founded By { invitationInfo.society.founder }
            </span>
            <span>
              Threshold { invitationInfo.society.threshold }
            </span>
            { invitationInfo.phase[0][1] === "Commit" ?
            <button onClick={() => handleKeygen(
              props.id, invitationInfo.society.threshold, 
              invitationInfo.society.members.length + 1, 48484
              )}> Commit 
            </button>
            : 
            <div>
              In Phase: { JSON.stringify(invitationInfo.phase) }
            </div>
            }
          </div>
        }
      </div>
    );
  }

  const Committed = (props) => {
    const [info, setInfo] = useState([]);

    const queryInfo = () => {
      Promise.all([
        handleQuerySociety(props.api, props.id),
        handleQuerySocietyStatus(props.api, props.id),
      ]).then(response => {
        let society = response[0].toHuman();
        let statusArray = response[1].toHuman();
        if (statusArray.length > 0) {
          let latest = statusArray.slice(-1);
          setInfo({society: society, phase: latest});
        }
      });
    }

    return (
      <div>
        <button onClick={queryInfo}>
          Society Id { props === null ? '' : props.id.toHuman() }
        </button>
        { info.length === 0 ?
          <div></div>:
          <div className="section">
            <span>
              Founded By { info.society.founder }
            </span>
            <span>
              Threshold { info.society.threshold }
            </span>
            { info.phase[0][1] === "Join" ?
            <button onClick={() => handleJoin(props.id)}> Join
            </button>
            : 
            <div>
              In Phase: { JSON.stringify(info.phase) }
            </div>
            }
          </div>
        }
      </div>
    );
  }

  const Active = (props) => {

    const [message, setMessage] = useState('');
    const [info, setInfo] = useState([]);

    const queryInfo = () => {
      Promise.all([
        handleQuerySociety(props.api, props.id),
        handleQuerySocietyStatus(props.api, props.id),
      ]).then(response => {
        let society = response[0].toHuman();
        let statusArray = response[1].toHuman();
        if (statusArray.length > 0) {
          let latest = statusArray.slice(-1);
          setInfo({society: society, phase: latest});
        }
      });
    }

    return (
      <div>
        <button onClick={queryInfo}>
          Society Id { props.id.toHuman() }
        </button>
        { info.length === 0 ?
          <div></div>:
          <div className="section">
            <span>
              Founded By { info.society.founder }
            </span>
            <span>
              Threshold { info.society.threshold }
            </span>
            <div>
              <input id="message-input" type="text" placeholder='Write a message' value={message} onChange={e => setMessage(e.target.value)} />
              <button onClick={() => handlePublishMessage(props.id, message)}>
                Publish message (max 32 bytes)
              </button>
            </div>
          </div>
        }
      </div>
    );
  }

  return (
    <div className='membership-container'>
      { isLoading === true ? 
      <div>
        { displayText }
      </div> :
      <div>
        <div className='container'>
          <span>Invites ({inviteIds.length})</span>
          <ul>
          { inviteIds.map((invite, idx) => {
            return (<li key={idx}>
              <div className='section'>
                <Invite id={invite} api={props.api} />
              </div>
            </li>);
          }) }
          </ul>
        </div>

        <div className='container'>
          <span>Committed ({ committedIds.length })</span>
          <ul>
          { committedIds.map((id, idx) => {
            return (<li key={idx}>
              <div className='section'>
                <Committed id={id} api={props.api} />
              </div>
            </li>);
          }) }
          </ul>
        </div>

        <div className='container'>
          <span>Active ({ activeIds.length })</span>
          <ul> 
          { activeIds.map((id, idx) => {
            return (<li key={idx}>
              <div className='section'>
                <Active id={id} api={props.api} />
              </div>
          </li>);
          }) }
          </ul>
        </div>
      
      </div>
      }
    </div>
  );
}

export default Memberships;