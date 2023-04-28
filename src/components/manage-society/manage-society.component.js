// import { useState } from "react";

// const Memberships = () => {

//     const [isLoading, setIsLoading] = useState(false);
//     const [displayText, setDisplayText] = useState(['']);
//     // a message to encrypt and publish (using gpk)
//     const [message, setMessage] = useState('');

//     const handleKeygen = (id, threshold, size) => {
//       let r1 = 45432;
//       let r2 = 48484;
//       setIsLoading(true);
//       setDisplayText([...displayText, 'Generating secrets']);
//       // TODO: make random
//       let seed = 23;
//       let poly = keygen(BigInt(seed), threshold);
//       let localId = id + ':' + acct.address;
//       localStorage.setItem(localId, JSON.stringify(poly));
//       setDisplayText([...displayText, 'Calculating shares and commitments']);
//       let sharesAndCommitments = calculate_shares_and_commitments(
//         threshold, size, BigInt(r2), poly.coeffs,
//       );
//       setDisplayText([...displayText, 'Submitting signed tx']);
//       api.tx.society.commit(
//         id, sharesAndCommitments,
//       ).signAndSend(acct, result => {
//         if (result.isFinalized) {
//           setDisplayText([...displayText, 'Tx finalized']);
//           updateMembershipMaps(api, acct);
//           setDisplayText('');
//           setIsLoading(false);
//         }
//       });
//     }

//     const handleJoin = (id) => {
//       setIsLoading(true);
//       setDisplayText([...displayText, 'Recovering secrets']);
//       let localId = id + ':' + acct.address;
//       let poly = JSON.parse(localStorage.getItem(localId));
//       // TODO: these vals should be encoded in the society?
//       let r1 = 45432;
//       let r2 = 48484;
//       let secret = calculate_secret(poly.coeffs);
//       setDisplayText([...displayText, 'Calculating pubkey']);
//       let pubkey = calculate_pubkey(BigInt(r1), BigInt(r2), secret);
//       setDisplayText([...displayText, 'Submitting signed tx']);
//       api.tx.society.join(
//         id, pubkey.g1, pubkey.g2,
//       ).signAndSend(acct, ({ status, events }) => {
//         if (status.isInBlock) {
//           updateMembershipMaps(api, acct);
//           setDisplayText('');
//           setIsLoading(false);
//         }
//       });
//     }
//   // const calculateGroupSecretKey = () => {
//   //   return society.reduce((a, b) => combine_secrets(a.secret, b.secret));
//   // }

//     const handlePublishMessage = async (id) => {
//       // the 'seed', random
//       let seed = 23;
//       // arbitrary
//       let r1 = 45432;
//       // how can I convert this to my  'SerializablePublicKey"?
//       let pubkeys = await api.query.society.pubkeys(id);
//       // each one is (author, pkg1, pkg2)
//       let gpk;
//       if (pubkeys.length === 1) {
//         gpk = {
//           g1: pubkeys[0][1],
//           g2: pubkeys[0][2],
//         };
//       } else {
//         gpk = pubkeys.toHuman()
//           .reduce((a, b) => 
//             combine_pubkeys(
//               { g1: a[1], g2: a[2] }, 
//               { g1: b[1], g2: b[2] })
//             );
//       }
//       let msg = message;
//       if (msg.length > 32) {
//         console.log('message too long');
//         return;
//       } else if (msg.length < 32) {
//         let max = 32 - msg.length;
//         // pad the message to 32 bytes
//         for (let i = 0; i < max; i++) {
//           msg += "0";
//         }
//       }
//       console.log('your message as bytes');
//       let msgBytes = new TextEncoder().encode(msg)
//       console.log(msgBytes);
//       let ciphertext = encrypt(BigInt(seed), BigInt(r1), msgBytes, gpk.g2);
//       console.log('your ciphertext as bytes');
//       console.log(ciphertext.v);
//       let { cid } = await ipfs.add(ciphertext.v);
//       api.tx.society.publish(
//         id, 
//         ciphertext.v, 
//         ciphertext.u,
//         ciphertext.w,
//         r1,
//       ).signAndSend(acct, ({ status, events }) => {
//         if (status.isInBlock || status.isFinalized) {
//           // an event will contain the hash..
//           events.forEach(e => {
//             let readableEvent = e.event.toHuman();
//             if (readableEvent.method === 'PublishedData') {
//               let hash = e.event.data[0];
//               // now we want to store the association of the hash with a CID
//               // in practice, this would be done in a smart contract
//               // for now, I'll just do store it in localstorage since I'm testing on one browser
//               // map hash to cid
//               localStorage.setItem(hash, cid);
//               // map cid to a society (so we can get the threshold value later on)
//               localStorage.setItem(cid, id);
//             }
//           });
//         }
//       });
//     }

//     return (
//       <div className='membership-container'>
//         { isLoading === true ? 
//         <div>
//           {displayText}
//         </div> :
//         <div>
//           <div className='container'>
//             <span>Invites ({invitations.length})</span>
//             <ul>
//             { invitations.map((item, idx) => {
//               let threshold = JSON.parse(item.society).threshold;
//               return (<li key={idx}>
//                 <div className='section'>
//                   <span>
//                     Society Id { item.id }
//                   </span>
//                   <span>
//                     Founded By { JSON.parse(item.society).founder }
//                   </span>
//                   <span>
//                     Threshold { threshold }
//                   </span>
//                   <span>
//                     Deadline { JSON.parse(item.society).deadline }
//                   </span>
//                   { JSON.stringify(item.status) }
//                   { item.status === "Commit" ?
//                   <button onClick={() => handleKeygen(
//                     item.id, threshold, 
//                     JSON.parse(item.society).members.length + 1, 48484
//                     )}> Commit 
//                   </button>
//                   : 
//                   <div>
//                     In Phase: { JSON.stringify(item.status) }
//                   </div>
//                   }
//                 </div>
//               </li>);
//             }) }
//             </ul>
//           </div>

//           <div className='container'>
//             <span>Committed ({committed.length})</span>
//             <ul>
//             { committed.map((item, idx) => {
//               let threshold = JSON.parse(item.society).threshold;
//               return (<li key={idx}>
//                 <div className='section'>
//                   <span>
//                     Society Id { item.id }
//                   </span>
//                   <span>
//                     Founded By { JSON.parse(item.society).founder }
//                   </span>
//                   <span>
//                     Threshold { threshold }
//                   </span>
//                   <span>
//                     Deadline { JSON.parse(item.society).deadline }
//                   </span>
//                   { JSON.stringify(item.status) }
//                   { item.status === "Join" ?
//                   <button onClick={() => handleJoin(item.id)}>
//                     Join
//                   </button>
//                   : 
//                   <div>
//                     In phase: { JSON.stringify(item.status) }
//                   </div>
//                   }
//                 </div>
//               </li>);
//             }) }
//             </ul>
//           </div>

//         </div>
//         }
//         <div className='container'>
//           <span>Active ({activeMemberships.length})</span>
//           <ul>
//           { activeMemberships.map((s, idx) => {
//             return (<li key={idx}>
//               <div className='section'>
//                 <span>
//                   id: { s.id }
//                 </span>
//                 <div>
//                   <input id="message-input" type="text" placeholder='Write a message' value={message} onChange={e => setMessage(e.target.value)} />
//                   <button onClick={() => handlePublishMessage(s.id)}>
//                     Publish
//                   </button>
//                 </div>
//                 <button onClick={() => handleQueryFs(s.id)}>
//                   Show File System
//                 </button>
//               </div>
//           </li>);
//           }) }
//           </ul>
//         </div>
//       </div>
//     );
//   }
