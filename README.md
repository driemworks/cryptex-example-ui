#  Cryptex Example

This repo contains code for a react project that interacts with the cryptex blockchain. So far, this is solely PoC/Experiement level work.

This little experiment is able to show a nice way to separate the encryption of shares from the threshold scheme itself. Encryption and decryption of 'reencryption keys' does not need to rely on the 'threshold', it can be any flavor of encryption as determined by the client.

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
- [ ] make seeds random
- [ ] separate into components
- [ ] call smart contract