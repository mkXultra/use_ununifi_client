const { cosmosclient, proto, rest } =  require("@cosmos-client/core");
const { ununifi } = require('ununifi-client')
const Long = require('long')
const host = "http://localhost:1317"
const chainId = 'ununifi-test-private-m1'

// console.log("🚀 ~ file: index.js ~ line 33 ~ core_1.cosmosclient.config.codecMaps.inv", cosmosclient.config.codecMaps.inv)
async function setupCosmosclient() {
  const sdk = new cosmosclient.CosmosSDK(host, chainId);
  const bech32Prefix = "ununifi"
  cosmosclient.config.setBech32Prefix({
    accAddr: bech32Prefix,
    accPub: bech32Prefix + cosmosclient.AddressPrefix.Public,
    valAddr:
      bech32Prefix + cosmosclient.AddressPrefix.Validator + cosmosclient.AddressPrefix.Operator,
    valPub:
      bech32Prefix +
      cosmosclient.AddressPrefix.Validator +
      cosmosclient.AddressPrefix.Operator +
      cosmosclient.AddressPrefix.Public,
    consAddr:
      bech32Prefix +
      cosmosclient.AddressPrefix.Validator +
      cosmosclient.AddressPrefix.Consensus,
    consPub:
      bech32Prefix +
      cosmosclient.AddressPrefix.Validator +
      cosmosclient.AddressPrefix.Consensus +
      cosmosclient.AddressPrefix.Public,
  });

  return sdk
}
async function getaccountInfo(sdk, mnt) {
  const privKey = await cosmosclient
    .generatePrivKeyFromMnemonic(mnt)
    .then((buffer) => new proto.cosmos.crypto.secp256k1.PrivKey({ key: buffer }));
  const pubKey = privKey.pubKey();
  const address = cosmosclient.AccAddress.fromPublicKey(pubKey);
  const fromAddress = address;
  const toAddress = address;
  const account = await rest.auth
      .account(sdk, fromAddress)
      .then((res) => cosmosclient.codec.protoJSONToInstance(cosmosclient.codec.castProtoJSONOfProtoAny(res.data.account)))
    .catch((error) => {
      console.log("🚀 ~ file: cosmos_client.js ~ line 41 ~ init ~ error", error)
      return null
    });

  if (!(account instanceof proto.cosmos.auth.v1beta1.BaseAccount)) {
    console.log(account);
    return;
  }
  return {
    account:account,
    address,
    pubKey,
    privKey
  }
}
async function broadcast(sdk, txBuilder) {
  const res = await rest.tx.broadcastTx(sdk, {
    tx_bytes: txBuilder.txBytes(),
    mode: rest.tx.BroadcastTxMode.Block,
  });
  return res
}

function createExTx(sdk, accountInfo){
  // build tx
  const msgSend = new proto.cosmos.bank.v1beta1.MsgSend({
    from_address: accountInfo.address.toString(),
    to_address: accountInfo.address.toString(),
    amount: [{ denom: 'uguu', amount: '1' }],
  });

  const txBody = new proto.cosmos.tx.v1beta1.TxBody({
    messages: [cosmosclient.codec.instanceToProtoAny(msgSend)],
  });
  const authInfo = new proto.cosmos.tx.v1beta1.AuthInfo({
    signer_infos: [
      {
        public_key: cosmosclient.codec.instanceToProtoAny(accountInfo.pubKey),
        mode_info: {
          single: {
            mode: proto.cosmos.tx.signing.v1beta1.SignMode.SIGN_MODE_DIRECT,
          },
        },
        sequence: accountInfo.account.sequence,
      },
    ],
    fee: {
      gas_limit: Long.fromString('200000'),
    },
  });
  const txBuilder = new cosmosclient.TxBuilder(sdk, txBody, authInfo);
  const signDocBytes = txBuilder.signDocBytes(accountInfo.account.account_number);
  txBuilder.addSignature(accountInfo.privKey.sign(signDocBytes));
  return txBuilder
}

function createCdpTx(sdk, accountInfo){
  const collateral = {
    denom:"ubtc",
    amount: "10"
  }
  const principal = {
    denom:"jpu",
    amount: "10"
  }
  const collateralType = 'ubtc-a'
  const pubKey = accountInfo.pubKey
  const privKey = accountInfo.privKey
    const msgCreateCdp = new ununifi.cdp.MsgCreateCdp({
      sender: accountInfo.address.toString(),
      collateral,
      principal,
      collateral_type: collateralType,
    });
    console.log("🚀 ~ file: cosmos_client.js ~ line 113 ~ createCdpTx ~ msgCreateCdp", msgCreateCdp)

    const txBody = new proto.cosmos.tx.v1beta1.TxBody({
      messages: [cosmosclient.codec.instanceToProtoAny(msgCreateCdp)],
    });
    const authInfo = new proto.cosmos.tx.v1beta1.AuthInfo({
      signer_infos: [
        {
          public_key: cosmosclient.codec.instanceToProtoAny(pubKey),
          mode_info: {
            single: {
              mode: proto.cosmos.tx.signing.v1beta1.SignMode.SIGN_MODE_DIRECT,
            },
          },
          sequence: accountInfo.account.sequence,
        },
      ],
      fee: {
        // amount: [fee],
        gas_limit: Long.fromString('300000'),
      },
    });

    console.log("🚀 ~ file: cosmos_client.js ~ line 144 ~ init ~ sdk", sdk.chainID)
    // sign
    const txBuilder = new cosmosclient.TxBuilder(sdk, txBody, authInfo);
    const signDocBytes = txBuilder.signDocBytes(accountInfo.account.account_number);
    txBuilder.addSignature(privKey.sign(signDocBytes));

    return txBuilder;
}

function createPricefeedTx(sdk, accountInfo){
  const pubKey = accountInfo.pubKey
  const privKey = accountInfo.privKey
  const marketID = "ubtc:jpy"
  // const mrketID = "ubtc:jpy:30"
  const newPrice = "2.984208922290198629"
  let expiryDate = new Date();
  const expiry = "14400"
  expiryDate = new Date(expiryDate.getTime() + Number.parseInt(expiry) * 1000);
    const msg = new ununifi.pricefeed.MsgPostPrice({
      from: accountInfo.address.toString(),
      market_id: marketID,
      price: newPrice,
      expiry: new proto.google.protobuf.Timestamp({
        seconds: Long.fromNumber(expiryDate.getTime() / 1000),
      }),
    });

    const txBody = new proto.cosmos.tx.v1beta1.TxBody({
      messages: [cosmosclient.codec.instanceToProtoAny(msg)],
    });
    const authInfo = new proto.cosmos.tx.v1beta1.AuthInfo({
      signer_infos: [
        {
          public_key: cosmosclient.codec.instanceToProtoAny(pubKey),
          mode_info: {
            single: {
              mode: proto.cosmos.tx.signing.v1beta1.SignMode.SIGN_MODE_DIRECT,
            },
          },
          sequence: accountInfo.account.sequence,
        },
      ],
      fee: {
        // amount: [fee],
        gas_limit: Long.fromString('300000'),
      },
    });

    console.log("🚀 ~ file: cosmos_client.js ~ line 144 ~ init ~ sdk", sdk.chainID)
    // sign
    const txBuilder = new cosmosclient.TxBuilder(sdk, txBody, authInfo);
    const signDocBytes = txBuilder.signDocBytes(accountInfo.account.account_number);
    txBuilder.addSignature(privKey.sign(signDocBytes));

    return txBuilder;
}

function createListingTx(sdk, accountInfo){
  const pubKey = accountInfo.pubKey
  const privKey = accountInfo.privKey
    const msg = new ununifi.nftmarket.MsgListNft({
      sender: accountInfo.address.toString(),
      nft_id:{
            class_id: "a10",
            nft_id: "a10",
      },
      listing_type: ununifi.nftmarket.ListingType.DIRECT_ASSET_BORROW,
      bid_token: "uguu",
      min_bid: "1",
      bid_hook: Long.fromString('2'),
    });
    console.log("🚀 ~ file: cosmos_client.js ~ line 113 ~ createCdpTx ~ msgCreateCdp", msg)

    const txBody = new proto.cosmos.tx.v1beta1.TxBody({
      messages: [cosmosclient.codec.instanceToProtoAny(msg)],
    });
    const authInfo = new proto.cosmos.tx.v1beta1.AuthInfo({
      signer_infos: [
        {
          public_key: cosmosclient.codec.instanceToProtoAny(pubKey),
          mode_info: {
            single: {
              mode: proto.cosmos.tx.signing.v1beta1.SignMode.SIGN_MODE_DIRECT,
            },
          },
          sequence: accountInfo.account.sequence,
        },
      ],
      fee: {
        // amount: [fee],
        gas_limit: Long.fromString('300000'),
      },
    });

    console.log("🚀 ~ file: cosmos_client.js ~ line 144 ~ init ~ sdk", sdk.chainID)
    // sign
    const txBuilder = new cosmosclient.TxBuilder(sdk, txBody, authInfo);
    const signDocBytes = txBuilder.signDocBytes(accountInfo.account.account_number);
    txBuilder.addSignature(privKey.sign(signDocBytes));

    return txBuilder;
}

async function init(mnt) {
  const sdk = await setupCosmosclient(mnt)
  console.log("🚀 ~ file: cosmos_client.js ~ line 144 ~ init ~ sdk", sdk.chainID)
  const accountInfo = await getaccountInfo(sdk, mnt)
  // const tx = createExTx(sdk, accountInfo)
  // const tx = createCdpTx(sdk, accountInfo)
  const tx = Tx(sdk, accountInfo)

  const res = await broadcast(sdk, tx)
  console.log("🚀 ~ file: cosmos_client.js ~ line 152 ~ init ~ res", res)
  console.log(
    JSON.stringify(JSON.parse(res.data.tx_response.raw_log),"", 2)
    );

  console.log("🚀 ~ file: cosmos_client.js ~ line 152 ~ init ~ res", res.data.tx_response.logs)
}
function Tx(sdk, accountInfo){
  // return createExTx(sdk, accountInfo)
  // return createCdpTx(sdk, accountInfo)
  // return createPricefeedTx(sdk, accountInfo)
  return createListingTx(sdk, accountInfo)
}
const mnt1 = "figure web rescue rice quantum sustain alert citizen woman cable wasp eyebrow monster teach hockey giant monitor hero oblige picnic ball never lamp distance"
const mnt2 = "chimney diesel tone pipe mouse detect vibrant video first jewel vacuum winter grant almost trim crystal similar giraffe dizzy hybrid trigger muffin awake leader"

const mnt = mnt1

init(mnt)
