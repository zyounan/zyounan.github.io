import React from 'react'
import IconButton from '@material-ui/core/IconButton'
import ArrowBackIcon from '@material-ui/icons/ArrowBack'
import { MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles';
import { lightBlue, indigo } from '@material-ui/core/colors'
import { Link } from 'gatsby'


import './index.scss'

const theme = createMuiTheme({
    palette: {
        primary: lightBlue,
        secondary: indigo,
    },
});

export const PostTitle = ({ title }) => {
    return (
        <div class="title-with-back-button">
            <Link to="/">
                <MuiThemeProvider theme={theme}>
                    <IconButton color="primary" aria-label="Back"
                    // onClick={history.back()}
                    >
                        <ArrowBackIcon />
                    </IconButton>
                </MuiThemeProvider>
            </Link>
            <h1>
                {title}
            </h1>
        </div>
    )
}
