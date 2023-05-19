import { Box, Typography } from "@mui/material";
import { useEffect, useState } from "react";

const Events = (props) => {

    const [eventsHistory, setEventsHistory] = useState([]);

    useEffect(() => {
        subscribeEvents();
    }, []);

    const subscribeEvents = async() => {
        // Subscribe to system events via storage
        props.api.query.system.events((events) => {
            console.log(`\nReceived ${events.length} events:`);

            events.forEach(e => {
                let readableEvent = e.event.toHuman();
                console.log('NEW EVENT');
                console.log(readableEvent);
            });
        });
    }

    const DisplayEvent = (props) => {
        return (
            <Box>
                <Typography sx={{ width: '10%', flexShrink: 0 }}>
                    section: { props.readableEvent.section }
                </Typography>
            </Box>
        );
    }

    return (
        <div className="events-container">
            I AM HERE
            { eventsHistory.map((evt, idx) => {
                console.log('hey');
                return <DisplayEvent readableEvent={evt} />
            }) }
        </div>
    );
}
export default Events;