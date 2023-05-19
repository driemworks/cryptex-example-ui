
import React, { useState } from "react";

import { Button, IconButton, Snackbar, TextField, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const TruncatedDisplay = (props) => {

    const [open, setOpen] = useState(false);

    const handleClose = (event, reason) => {
        if (reason === 'clickaway') {
          return;
        }
    
        setOpen(false);
      };
    
      
      const action = (
        <React.Fragment>
          {/* <Button color="secondary" size="small" onClick={handleClose}>
            UNDO
          </Button> */}
          <IconButton
            size="small"
            aria-label="close"
            color="inherit"
            onClick={handleClose}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </React.Fragment>
      );

    let msg = props.data === '' || props.data === undefined ? '' :    
      props.data.slice(0, 12) + '...';
    return (
        <div>
            <Snackbar
                open={open}
                autoHideDuration={3000}
                onClose={handleClose}
                message="Copied!"
                action={action}
            />
          <div>
            <Tooltip title={props.data}>
              <span>{ props.message + msg }</span>
            </Tooltip>
            <ContentCopyIcon className='hoverable' onClick={() => {
              navigator.clipboard.writeText(props.data);
              setOpen(true);
            }}/>
        </div>
    </div>
    );

}

export default TruncatedDisplay;