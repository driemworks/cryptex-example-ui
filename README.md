#  Enigma

Enigma is an experiment

> The code in this repo is experiment, use at your own risk.

## Setup

``` bash
npm i
npm run start
```

## Local Development
For local devlopment, update the `package.json` to point to a local wasm-pack build of the dkg-wasm library (https://github.com/ideal-lab5/dkg/tree/main/dkg-wasm).

To bypass cors for IPFS when developing locally, configure your node as follows:

``` bash
ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080
ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin "[\"*\"]"
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Credentials "[\"true\"]"
```

##  TODO
- [ ] encrypt/decrypt share
- [ ] use extension to get account https://polkadot.js.org/docs/extension/usage/
- [ ] deploy + call smart contract
- [ ] use react router
- [ ] allow arbitrary length messages, use new delimiter (using 0 for now for padding, not really good)
- [ ] ipfs config + other settings
- [ ] validate member addresses when creating society