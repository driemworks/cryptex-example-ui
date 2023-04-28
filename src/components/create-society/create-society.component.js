import { useState } from "react";

const CreateSociety = (props) => {

    const [threshold, setThreshold] = useState(0);
    const [deadline, setDeadline] = useState(0);
    const [name, setName] = useState('');
    const [id, setId] = useState('');
    const [newMember, setNewMember] = useState('');
    const [members, setMembers] = useState([]);

    const [isLoading, setIsLoading] = useState(false);

    const handleCreateSociety = () => {
      setIsLoading(true);
      props.api.tx.society.create(
        id, threshold, name, deadline, members,
      ).signAndSend(props.acct, result => {
        if (result.isFinalized) {
          // will emit an event in the future
          setIsLoading(false);
          setMembers([]);
          setThreshold(0);
          setDeadline(0);
          setName('');
          setId('');
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
export default CreateSociety;
