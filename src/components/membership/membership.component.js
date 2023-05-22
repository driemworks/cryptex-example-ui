/* global BigInt */
import { useEffect, useReducer, useState } from "react";
import { 
    keygen, calculate_pubkey, combine_pubkeys,
    calculate_shares_and_commitments, calculate_secret,
    encrypt } from 'dkg-wasm';

import Tab from '@mui/material/Tab';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import Box from '@mui/material/Box';

import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Typography from '@mui/material/Typography';

import './membership.component.css';
import { Button } from "@mui/material";
import TruncatedDisplay from "../common/truncate-display.component";

const Memberships = (props) => {

    // const [ignored, forceUpdate] = useReducer(x => x + 1, 0);
    const [isLoading, setIsLoading] = useState(false);
    const [displayText, setDisplayText] = useState([]);

    const [inviteIds, setInviteIds] = useState([]);
    const [committedIds, setCommittedIds] = useState([]);
    const [activeIds, setActiveIds] = useState([]);
    const [foundedIds, setFoundedIds] = useState([]);
    const [selectSocietyPhase, setSelectSocietyPhase] = useState('0');

    useEffect(() => { 
      let mounted = true;
      if (props.acct !== null) {
        if (mounted === true) {
          getSocieties();
          mounted = false;
        }
      }
    }, [props.acct]);

  const getSocieties = async () => {
    await activeSocietyListener(props.api, props.acct);
    await committedSocietyListener(props.api, props.acct);
    await inviteeSocietyListener(props.api, props.acct);
    await foundedSocietyListener(props.api, props.acct);
  }

  const activeSocietyListener = async(api, acct) => {
    let ids = await api.query.society.membership(acct.address, "active");
    setActiveIds(ids);
  }

  const inviteeSocietyListener = async(api, acct) => {
    let ids = await api.query.society.membership(acct.address, "invitee");
    setInviteIds(ids);
  }

  const committedSocietyListener = async(api, acct) => {
    let ids = await api.query.society.membership(acct.address, "committed");
    setCommittedIds(ids);
  } 

  const foundedSocietyListener = async(api, acct) => {
    let ids = await api.query.society.membership(acct.address, "founder");
    setFoundedIds(ids);
  }

  const handleQuerySociety = async(api, id) => {
    let society = await api.query.society.societies(id);
    return society;
  }

  const handleQuerySocietyStatus = async(api, id) => { 
    let status = await api.query.society.societyStatus(id);
    return status;
  }

  const handleQuerySharesAndCommitments = async (api, id) => {
    let shares = await api.query.society.sharesAndCommitments(id);
    return shares;
  }

  const handleQueryPubkeys = async (api, id) => {
    let pks = await api.query.society.pubkeys(id);
    return pks;
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
      cid,
    ).signAndSend(props.addr, {signer: props.signer}, {signer: props.signer}, ({ status, events }) => {
      if (status.isInBlock || status.isFinalized) {
        // an event will contain the hash..
        events.forEach(e => {
          let readableEvent = e.event.toHuman();
          if (readableEvent.method === 'PublishedData') {
            // let hash = e.event.data[0];
            // // now we want to store the association of the hash with a CID
            // // in practice, this would be done in a smart contract
            // // for now, I'll just do store it in localstorage since I'm testing on one browser
            // // map hash to cid
            // localStorage.setItem(hash, cid);
            // // map cid to a society (so we can get the threshold value later on)
            // localStorage.setItem(cid, id);
            setIsLoading(false);
            setDisplayText([]);
          }
        });
      }
    });
  }

  const PhaseManager = (props) => {

    const [isLoading, setIsLoading] = useState(false);

    const handleTryForceJoinPhase = async() => {
      setIsLoading(true);
      await props.api.tx.society
        .tryForceJoinPhase(props.id)
        .signAndSend(props.addr, {signer: props.signer}, result => {
          if (result.isFinalized) {
            console.log('updated to join phase');
            setIsLoading(false);
            getSocieties();
          }
        });
    }
  
    const handleTryForceActivePhase = async () => {
      setIsLoading(true);
      await props.api.tx.society
        .tryForceActivePhase(props.id)
        .signAndSend(props.addr, {signer: props.signer}, result => {
          if (result.isFinalized) {
            console.log('updated to active phase');
            // forceUpdate();
            setIsLoading(false);
            getSocieties();
          }
        });
    }

    return (
      <div>
        <span>Society in phase: { JSON.stringify(props.info.phase[0][1]) }</span>
        {
          // if you are the owner
          // if there are at least a threshold of commitments
          props.info.society.founder === props.acct.address
            && props.shareCount / props.info.society.members.length >= props.info.society.threshold ? 
          <div>
            { props.info.phase[0][1] === 'Commit' ? 
            <div>
              { !isLoading ?
              <Button onClick={handleTryForceJoinPhase}>
                Update to Join Phase
              </Button> :
              <div>
                Loading...
              </div>
              }
            </div>
            : props.info.phase[0][1] === 'Join' ? 
            <div>
              { props.pubkeys.length >= props.info.society.threshold ? 
                <div>
                  { !isLoading ?
                  <Button onClick={handleTryForceActivePhase}>
                    Activate Society
                  </Button> :
                  <div>
                    Loading...
                  </div>
                }
                </div> :
                <div>
                  <span>Waiting for more commitments: received {props.pubkeys.length} of {props.info.society.threshold}</span>
                </div>
              }
              
            </div> :
            <div>
            </div>
            }
          </div>
          : <div>Waiting for commitments</div>
        }
      </div>
    );
  }

  const Invite = (props) => {
    const [invitationInfo, setInvitiationInfo] = useState([]);
    const [shareCount, setShareCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const queryInviteInfo = () => {
      Promise.all([
        handleQuerySociety(props.api, props.id),
        handleQuerySocietyStatus(props.api, props.id),
        handleQuerySharesAndCommitments(props.api, props.id),
      ]).then(response => {
        let society = response[0].toHuman();
        let statusArray = response[1].toHuman();
        let shares = response[2].toHuman();
        console.log(shares);
        setShareCount(shares.length);
        if (statusArray.length > 0) {
          let latest = statusArray.slice(-1);
          setInvitiationInfo({society: society, phase: latest});
        }
      });
    }

    const handleKeygen = (id, threshold, size) => {
      let r1 = 45432;
      let r2 = 48484;
      setIsLoading(true);
      let seed = Math.floor(Math.random() * 10000000) + 1;
      let poly = keygen(BigInt(seed), threshold);
      let localId = id.toHuman() + ':' + props.acct.address;
      localStorage.setItem(localId, JSON.stringify(poly));
      let sharesAndCommitments = calculate_shares_and_commitments(
        threshold, size, BigInt(r2), poly.coeffs,
      );
      props.api.tx.society.commit(
        id, sharesAndCommitments,
      ).signAndSend(props.addr, {signer: props.signer}, result => {
        if (result.isFinalized) {
          setIsLoading(false);
          getSocieties();
        }
      });
    }
  
    return (
      <Accordion onChange={queryInviteInfo}>
        <AccordionSummary>
          <Typography sx={{ width: '50%', flexShrink: 0 }}>
            Society Id { props.id.toHuman() }
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <div>
            { invitationInfo.length === 0 ?
              <div></div>:
              <div className="society">
                <TruncatedDisplay data={invitationInfo.society.founder} message="Founded by: "/>
                <span>
                  Commitments: { shareCount/invitationInfo.society.members.length } of { invitationInfo.society.threshold }
                </span>
                <PhaseManager
                  api={props.api} acct={props.acct} 
                  addr={props.addr} signer={props.signer}
                  id={props.id} shareCount={shareCount} info={invitationInfo}
                  pubkeys={[]}
                />
                { invitationInfo.phase[0][1] === "Commit" ?
                <div>
                  { !isLoading ?
                  <Button onClick={() => handleKeygen(
                    props.id, invitationInfo.society.threshold, 
                    invitationInfo.society.members.length + 1, 48484
                    )}> Commit 
                  </Button> :
                  <div>
                    Loading...
                  </div>
                  }
                </div>
                : 
                <div>
                  In Phase: { JSON.stringify(invitationInfo.phase) }
                </div>
                }
              </div>
            }
          </div>
        </AccordionDetails>
      </Accordion>
    );
  }

  const Committed = (props) => {
    const [info, setInfo] = useState([]);
    const [shareCount, setShareCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const queryInfo = () => {
      Promise.all([
        handleQuerySociety(props.api, props.id),
        handleQuerySocietyStatus(props.api, props.id),
        handleQuerySharesAndCommitments(props.api, props.id),
      ]).then(response => {
        let society = response[0].toHuman();
        let statusArray = response[1].toHuman();
        let shares = response[2].toHuman();
        setShareCount(shares.length);
        if (statusArray.length > 0) {
          let latest = statusArray.slice(-1);
          setInfo({society: society, phase: latest});
        }
      });
    }

    const handleJoin = (id) => {
      setIsLoading(true);
      let localId = id.toHuman() + ':' + props.acct.address;
      let poly = JSON.parse(localStorage.getItem(localId));
      // TODO: these vals should be encoded in the society?
      let r1 = 45432;
      let r2 = 48484;
      let secret = calculate_secret(poly.coeffs);
      let pubkey = calculate_pubkey(BigInt(r1), BigInt(r2), secret);
      props.api.tx.society.join(
        id, pubkey.g1, pubkey.g2,
      ).signAndSend(props.addr, {signer: props.signer}, ({ status, events }) => {
        if (status.isFinalized) {
          setIsLoading(false);
          getSocieties();
        }
      });
    }

    return (
      <Accordion onChange={queryInfo}>
        <AccordionSummary>
          <Typography sx={{ width: '50%', flexShrink: 0 }}>
          Society Id { props === null ? '' : props.id.toHuman() }
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
        { info.length === 0 ?
          <div></div>:
          <div className="society">
            <TruncatedDisplay data={info.society.founder} message="Founded by: "/>
            <span>
              Threshold { info.society.threshold }
            </span>
            <PhaseManager
              api={props.api} acct={props.acct} 
              addr={props.addr} signer={props.signer}
              id={props.id} shareCount={shareCount} info={info}
              pubkeys={[]}
            />
            <div>
              { info.phase[0][1] === "Join" ?
              <div>
                { !isLoading ? 
                <Button onClick={() => handleJoin(props.id)}>Join</Button> :
                <div>
                  Loading...
                </div>
              }</div> : 
              <div>
                Waiting for founder to update phase.
              </div>
              }
            </div>
          </div>
        }
        </AccordionDetails>
      </Accordion>
    );
  }

  const Active = (props) => {

    const [message, setMessage] = useState('');
    const [info, setInfo] = useState([]);
    const [shareCount, setShareCount] = useState(0);
    const [pubkeys, setPubkeys] = useState([]);

    const queryInfo = () => {
      Promise.all([
        handleQuerySociety(props.api, props.id),
        handleQuerySocietyStatus(props.api, props.id),
        handleQuerySharesAndCommitments(props.api, props.id),
        handleQueryPubkeys(props.api, props.id),
      ]).then(response => {
        let society = response[0].toHuman();
        let statusArray = response[1].toHuman();
        let shares = response[2].toHuman();
        setShareCount(shares.length);
        let pks = response[3].toHuman();
        setPubkeys(pks);
        if (statusArray.length > 0) {
          let latest = statusArray.slice(-1);
          setInfo({society: society, phase: latest});
        }
      });
    }

    return (
      <Accordion onChange={queryInfo}>
        <AccordionSummary>
          <Typography sx={{ width: '50%', flexShrink: 0 }}>
          Society Id { props === null ? '' : props.id.toHuman() }
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
        { info.length === 0 ?
          <div></div>:
          <div className="society">
            {/* <span>
              Founded By { info.society.founder }
            </span> */}
            <TruncatedDisplay data={info.society.founder} message="Founded by: "/>
            <span>
              Threshold { info.society.threshold }
            </span>
            { info.phase[0][1] !== 'Active' ? 
            <div>
              <PhaseManager
                api={props.api} acct={props.acct} 
                addr={props.addr} signer={props.signer}
                id={props.id} shareCount={shareCount} info={info}
                pubkeys={pubkeys}
              />
            </div>
            :
            <div>
              <input id="message-input" type="text" placeholder='Write a message' value={message} onChange={e => setMessage(e.target.value)} />
              <Button onClick={() => handlePublishMessage(props.id, message)}>
                Publish message (max 32 bytes)
              </Button>
            </div>
            }
          </div>
        }
      </AccordionDetails>
      </Accordion>
    );
  }

  const Founded = (props) => {

    const [info, setInfo] = useState([]);
    const [shareCount, setShareCount] = useState(0);
    const [pubkeys, setPubkeys] = useState([]);

    const queryInfo = () => {
      Promise.all([
        handleQuerySociety(props.api, props.id),
        handleQuerySocietyStatus(props.api, props.id),
        handleQuerySharesAndCommitments(props.api, props.id),
        handleQueryPubkeys(props.api, props.id),
      ]).then(response => {
        let society = response[0].toHuman();
        let statusArray = response[1].toHuman();
        let shares = response[2].toHuman();
        setShareCount(shares.length);
        let pks = response[3].toHuman();
        setPubkeys(pks);
        if (statusArray.length > 0) {
          let latest = statusArray.slice(-1);
          setInfo({society: society, phase: latest});
        }
      });
    }

    return (
      <Accordion onChange={queryInfo}>
        <AccordionSummary>
          <Typography sx={{ width: '50%', flexShrink: 0 }}>
          Society Id { props === null ? '' : props.id.toHuman() }
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
        { info.length === 0 ?
          <div></div>:
          <div className="society">
            <div>
              <PhaseManager
                api={props.api} acct={props.acct} 
                addr={props.addr} signer={props.signer}
                id={props.id} shareCount={shareCount} info={info}
                pubkeys={pubkeys}
              />
            </div>
          </div>
        }
        </AccordionDetails>
      </Accordion>
    );
  }

  const handleSelectSocietyPhase = (event, newValue) => {
    setSelectSocietyPhase(newValue);
  };

  return (
    <div className='section'>
      <div className="membership-container">
        <div>
          <TabContext value={selectSocietyPhase}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <TabList onChange={handleSelectSocietyPhase} aria-label="Tabs">
              <Tab label={"Invites (" + inviteIds.length + ")"} disabled={inviteIds.length === 0} />
              <Tab label={"Committed (" + committedIds.length + ")"} disabled={committedIds.length === 0} />
              <Tab label={"Active (" + activeIds.length + ")"} disabled={activeIds.length === 0} />
              <Tab label={"Founded (" + foundedIds.length + ")"} disabled={foundedIds.length === 0} />
            </TabList>
          </Box>
          <TabPanel value={0}>
            <div>
            { inviteIds.map((invite, idx) => {
              return (<Invite key={idx} id={invite} api={props.api} acct={props.acct} addr={props.addr} signer={props.signer} />);
            }) }
            </div>
          </TabPanel>
          <TabPanel value={1}>
            <div>
            { committedIds.map((id, idx) => {
              return (<Committed key={idx} id={id} api={props.api} acct={props.acct} addr={props.addr} signer={props.signer} />);
            }) }
            </div>
          </TabPanel>
          <TabPanel value={2}>
            <div>
              { activeIds.map((id, idx) => {
                return (<Active key={idx} id={id} api={props.api} acct={props.acct} addr={props.addr} signer={props.signer} />);
              })}
            </div>
          </TabPanel>
          <TabPanel value={3}>
            <div>
              { foundedIds.map((id, idx) => {
                return (<Founded key={idx} id={id} api={props.api} acct={props.acct} addr={props.addr} signer={props.signer} />);
              })}
            </div>
          </TabPanel>
        </TabContext>
      </div>
      </div>
    </div>
  );
}

export default Memberships;