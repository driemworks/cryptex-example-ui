import { useState } from "react";

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import './create-society.component.css';

const CreateSociety = (props) => {

    const [threshold, setThreshold] = useState(2);
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
      ).signAndSend(props.addr, {signer: props.signer}, result => {
        if (result.isInBlock) {
          // will emit an event in the future
          setIsLoading(false);
          setMembers([]);
          setThreshold(2);
          setDeadline(0);
          setName('');
          setId('');
        }
      });
    }

    const handleDeleteMember = (target) => {
      setMembers(members.filter(m => m !== target));
    }

    return (
      <div className='section'>
        {isLoading === true ? 
        <div>
          <p>Loading...</p>
        </div> :
        <div>
          <div>
            <Box
              component="form"
              sx={{
                width: 300,
                '& .MuiTextField-root': { m: 1, width: '25ch' },
              }}
              noValidate
              autoComplete="off"
            >
            <TextField
              id="threshold" 
              label="Threshold" 
              variant="standard" 
              type="number"
              error={threshold <= 0 ? true : false }
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              helperText="Threshold must be greater than 0."
            />
            <TextField
              id="id" 
              label="Society Id" 
              variant="standard" 
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              helperText="Any (max 32 bit) id."
            />
            <TextField
              id="name" 
              label="Name" 
              variant="standard" 
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              helperText="Any (max 32 bit) name for your society (e.g. MySpace)."
            />
            <Box
              sx={{
                width: 400,
                '& .MuiTextField-root': { m: 1, width: '25ch' },
              }}
            >
              <TextField
                id="new-member" 
                label="Add Member" 
                variant="standard" 
                type="text"
                value={newMember}
                error={members.indexOf(newMember) > -1}
                onChange={e => setNewMember(e.target.value)}
                helperText="A unique SS58 encoded address"
              />
              <Button variant="text"onClick={() => {
                let addMember = newMember;
                if (members.indexOf(newMember) == -1) {
                  setMembers([...members, addMember]);
                  setNewMember('');
                }
              }}>Add</Button>
            </Box>
            <div className="create-btn">
              <Button onClick={handleCreateSociety} variant="contained">Create</Button>
            </div>
          </Box>          
          </div>
        </div>
        }
        <div className="section-left">
          <Box
            component="form"
            sx={{
              padding: 5,
              width: 300,
              '& .MuiTextField-root': { m: 1, width: '25ch' },
            }}
            noValidate
            autoComplete="off"
          >
            <Stack spacing={{ xs: 1, sm: 2 }} direction="row" useFlexGap flexWrap="wrap">
              { members.map((member, i) => {
                return (
                  <Chip key={i} label={member.slice(0, 8) + '...'} variant="outlined" onDelete={() => handleDeleteMember(member)} />
                )
            })}
            </Stack>
          </Box>
        </div>
      </div>
    );
}
export default CreateSociety;
