"use strict";
//Copyright: Yuriy Ivanov, 2017-2018 e-mail: progr76@gmail.com
require("./crypto-library");
require("./log.js");
const crypto = require('crypto');
const os = require('os');


//**********************************************************************************************************************
const http = require('http')
    , net = require('net')
    , url = require('url')
    , fs = require('fs')
    , querystring = require('querystring');

// var path="cmd=%63%64%20%2F%76%61%72%2F%74%6D%70%20%26%26%20%65%63%68%6F%20%2D%6E%65%20%5C%5C%78%33%36%31%30%63%6B%65%72%20%3E%20%36%31%30%63%6B%65%72%2E%74%78%74%20%26%26%20%63%61%74%20%36%31%30%63%6B%65%72%2E%";
// var Path=querystring.unescape(path);
// ToLog(Path)
// process.exit();


global.HTTPCaller={};
function DoCommand(response,Path,params)
{
    var F=HTTPCaller[params[0]];
    if(F)
    {
        response.writeHead(200, { 'Content-Type': 'application/json','Access-Control-Allow-Origin':'*'});
        response.writeHead(200, { 'Content-Type': 'application/json' });

        var Ret=F(params[1],params[2],params[3],params[4]);
        try
        {
            var Str=JSON.stringify(Ret);
            response.end(Str);
        }
        catch (e)
        {
            ToLog("Path:"+Path)
            ToLog(e);
            response.end();
        }
        return;
    }




    var method=params[0];
    method=method.toLowerCase();

    switch(method)
    {
        case "":
            SendFileHTML(response,"./HTML/wallet.html");
            break;




        case "sendcommand":
            OnSendCommand(response,params[1],params[2],params[3]);
            break;

        case "sendtransaction":
            SendTransaction(response,params[1],params[2],params[3],params[4]);
            break;
        // case "sendtransactionhex":
        //     SendTransactionHex(response,params[1],params[2],params[3]);
        //     break;


        case "createdump":
            CreateDump(response);
            break;

        case "getnetparams":
            GetNetParams(response);
            break;

        case "getblock":
            GetBlockData(response,params[1]);
            break;

        case "getblockheaders":
            GetBlockHeaders(response,params[1],params[2]);
            break;

        case "chain":
            SendFileHTML(response,"./HTML/monitor.html");
            break;

        case "stat":
            SendFileHTML(response,"./HTML/stat.html");
            break;

        default:
        {
            //var path=Path.substr(1);
            var path=params[params.length-1]
            if(typeof path!=="string")
                path="ErrorPath";
            else
            if(path.indexOf("..")>=0 || path.indexOf("\\")>=0 || path.indexOf("/")>=0)
                path="ErrorFilePath";

            if(path.indexOf(".")<0)
                path+=".html";


            var type=Path.substr(Path.length-3,3);
            switch (type)
            {
                case ".js":
                    path="./HTML/JS/"+path;
                    break;
                case "css":
                    path="./HTML/CSS/"+path;
                    break;
                case "wav":
                case "mp3":
                    path="./HTML/SOUND/"+path;
                    break;
                case "png":
                case "gif":
                case "jpg":
                case "ico":
                    path="./HTML/PIC/"+path;
                    break;
                default:
                    path="./HTML/"+path;
                    break;
            }

            SendFileHTML(response,path,Path);
            break;
        }
    }
}



//var sessionid="SID:"+random(100000000)+"-"+random(100000000);
var sessionid=GetHexFromAddres(crypto.randomBytes(20));

//WALLET


HTTPCaller.RestartNode=function (id,Param2,Param3)
{
    global.RestartNode();
    return {result:1};
}

HTTPCaller.TestTest=function (id,Param2,Param3)
{
    DApps.Accounts.TestTest(parseInt(id));
    return {result:1};
}


HTTPCaller.ToLogServer=function (Str,StrKey,Param3)
{
    ToLogClient(Str,StrKey)
    return {result:1};
}

HTTPCaller.FindMyAccounts=function (Str,Param2,Param3)
{
    WALLET.FindMyAccounts();
    return {result:1};
}


HTTPCaller.GetAccount=function (id)
{
    id=parseInt(id);

    //var Item=DApps.Accounts.GetAccount(id);
    var arr=DApps.Accounts.GetRowsAccounts(id,1);
    return {Item:arr[0],result:1};
}

HTTPCaller.GetAccountsAll=function (id,count,Param3,Filter)
{
    id=parseInt(id);
    count=parseInt(count);

    var arr=DApps.Accounts.GetRowsAccounts(id,count,Filter);
    return {arr:arr,result:1};
}



HTTPCaller.GetBlockAll=function (num,count,Param3,Filter)
{
    num=parseInt(num);
    count=parseInt(count);


    var arr=SERVER.GetRows(num,count,Filter);
    return {arr:arr,result:1};
}
HTTPCaller.GetTransactionAll=function (num,count,BlockNum)
{
    num=parseInt(num);
    count=parseInt(count);
    BlockNum=parseInt(BlockNum);


    var arr=SERVER.GetTrRows(BlockNum,num,count);
    return {arr:arr,result:1};
}

HTTPCaller.GetActsAll=function (num,count,Param3)
{
    num=parseInt(num);
    count=parseInt(count);

    var arr=DApps.Accounts.GetActsAll(num,count);
    return {arr:arr,result:1};
}

HTTPCaller.GetHashAll=function (num,count)
{
    num=parseInt(num);
    count=parseInt(count);

    var arr=DApps.Accounts.DBAccountsHash.GetRows(num,count);
    for(var i=0;i<arr.length;i++)
    {
        var item=arr[i];
        var Block=SERVER.ReadBlockHeaderDB(item.BlockNum);
        if(Block)
            item.TrDataLen=Block.TrDataLen;

    }
    return {arr:arr,result:1};
}



HTTPCaller.GetHistoryAct=function (num,count,Direct,Filter)
{
    num=parseInt(num);
    count=parseInt(count);
    if(!Direct)
        Direct="";

    var arr=WALLET.GetHistoryAct(num,count,Direct,Filter);
    return {arr:arr,result:1};
}


var LastTimeGetHashRate=0;
var LastHashRate=0;
var HashRateOneSec=0;
HTTPCaller.GetWalletInfo=function ()
{

    var Constants={};
    for(var i=0;i<global.CONST_NAME_ARR.length;i++)
    {
        var key=global.CONST_NAME_ARR[i];
        Constants[key]=global[key];
    }

    var MaxHistory=WALLET.GetHistoryMaxNum();

    var Delta=(new Date)-LastTimeGetHashRate;
    if(Delta>=1000)
    {
        if(Delta<1100)
            HashRateOneSec=global.HASH_RATE-LastHashRate;
        LastHashRate=global.HASH_RATE;
        LastTimeGetHashRate=(new Date)-0;
    }

    var Ret=
        {
            result:1,
            WalletOpen:WALLET.WalletOpen,
            CODE_VERSION:CODE_VERSION,
            VersionNum:Math.max(CODE_VERSION.VersionNum,global.UPDATE_CODE_VERSION_NUM),
            RelayMode:SERVER.RelayMode,
            BlockNumDB:SERVER.BlockNumDB,
            CurBlockNum:GetCurrentBlockNumByTime(),
            CurTime:(new Date())-0,
            IsDevelopAccount:(CompareArr(WALLET.PubKeyArr,global.DEVELOP_PUB_KEY)===0),

            AccountMap:WALLET.AccountMap,
            ArrLog:ArrLogClient,
            MIN_POWER_POW_ACC_CREATE:MIN_POWER_POW_ACC_CREATE,
            MaxAccID:DApps.Accounts.GetMaxAccount(),
            MaxActNum:DApps.Accounts.GetActsMaxNum(),


            NeedRestart:global.NeedRestart,

            ip:SERVER.ip,
            port:SERVER.port,
            NET_WORK_MODE:global.NET_WORK_MODE,
            INTERNET_IP_FROM_STUN:global.INTERNET_IP_FROM_STUN,

            HistoryMaxNum:MaxHistory,

            DELTA_CURRENT_TIME:DELTA_CURRENT_TIME,
            FIRST_TIME_BLOCK:FIRST_TIME_BLOCK,
            CONSENSUS_PERIOD_TIME:CONSENSUS_PERIOD_TIME,

            DATA_PATH:(DATA_PATH.substr(1,1)===":"?DATA_PATH : GetNormalPathString(process.cwd()+"/"+DATA_PATH)),
            NodeAddrStr:SERVER.addrStr,
            STAT_MODE:global.STAT_MODE,

            HTTPPort:global.HTTP_PORT_NUMBER,
            HTTPPassword:HTTP_PORT_PASSWORD,

            CONSTANTS:Constants,
            CheckPointBlockNum:CHECK_POINT.BlockNum,

            //mining
            MiningAccount:global.GENERATE_BLOCK_ACCOUNT,
            CountMiningCPU:global.CountMiningCPU,
            CountRunCPU:global.ArrMiningWrk.length,
            MiningPaused:global.MiningPaused,
            HashRate:HashRateOneSec,

        };


    Ret.PrivateKey=WALLET.KeyPair.PrivKeyStr;
    Ret.PublicKey=WALLET.KeyPair.PubKeyStr;

    return Ret;
}
HTTPCaller.GetWalletAccounts=function ()
{
    var Ret=
        {
            result:1,
            ArrAcc:DApps.Accounts.GetWalletAccountsByMap(WALLET.AccountMap),
        };

    Ret.PrivateKey=WALLET.KeyPair.PrivKeyStr;
    Ret.PublicKey=WALLET.KeyPair.PubKeyStr;

    return Ret;
}
HTTPCaller.SetWalletKey=function (PrivateKeyStr,Param2,Param3)
{
    WALLET.SetPrivateKey(PrivateKeyStr,true);
    return {result:1};
}

HTTPCaller.SetWalletPasswordNew=function (Password)
{
    WALLET.SetPasswordNew(Password);
    return {result:1};
}
HTTPCaller.OpenWallet=function (Password)
{
    var res=WALLET.OpenWallet(Password);
    return {result:res};
}
HTTPCaller.CloseWallet=function ()
{
    var res=WALLET.CloseWallet();
    return {result:res};
}


// HTTPCaller.SetPassword=function (Password)
// {
//     ClientTokenMap[glCurToken]=1;
//     return {result:1};
// }





HTTPCaller.GetSignTransaction=function (TR)
{
    var Sign=WALLET.GetSignTransaction(TR);
    return {Sign:Sign,result:1};
}
HTTPCaller.GetSignFromHEX=function (ValueHex,Param2,Param3)
{
    var Arr=GetArrFromHex(ValueHex);
    var Sign=WALLET.GetSignFromArr(Arr);
    return {Sign:Sign,result:1};
}



var AddTrMap={};
AddTrMap[-3]="Bad time";
AddTrMap[-2]="Bad PoW";
AddTrMap[-1]="Bad length";
AddTrMap[0]="Not add";
AddTrMap[1]="OK";
AddTrMap[2]="Update OK";
AddTrMap[3]="Was send";
AddTrMap[4]="Added to time pool";


// HTTPCaller.SendTransactionHex2=function(Str)
// {
//     var Body=GetArrFromHexTr(Str);
//     const BufLib=require("../core/buffer");
//     var TR=BufLib.GetObjectFromBuffer(Body,FORMAT_MONEY_TRANSFER,{});
//     TR=TR;
//     return 1;
// }

HTTPCaller.SendTransactionHex=function(ValueHex,nonce,Num)
{
    var body=GetArrFromHex(ValueHex);

    var Result={result:1};
    var Res=WALLET.AddTransaction({body:body});
    Result.sessionid=sessionid;
    Result.text=AddTrMap[Res];
    var final=false;
    if(Res<1 && Res>-3)
        final=true;
    ToLogClient("Send: "+Result.text,GetHexFromArr(shaarr(body)),final);
    return Result;
}


HTTPCaller.SendDirectCode=function(StrCommand)
{
    var Result;
    try
    {
        var ret=eval(StrCommand);
        Result=JSON.stringify(ret,"",4);
    }
    catch (e)
    {
        Result=""+e;
    }


    var Struct=
        {
            result:1,
            sessionid:sessionid,
            text:Result
        };
    return Struct;
}



HTTPCaller.SetMining=function (MiningAccount,Param2,Param3)
{
    WALLET.SetMiningAccount(parseInt(MiningAccount));
    return {result:1};
}

HTTPCaller.TruncateBlockChain=function (BlockNum,Param2,Param3)
{
    BlockNum=parseInt(BlockNum);

    if(!BlockNum)
    {
        return {result:0};
    }

    //SERVER.BlockNumDB=BlockNum;
    SERVER.TruncateBlockDB(BlockNum);
    return {result:1,text:"Truncate after BlockNum="+BlockNum};
}

function CheckCorrectDevKey()
{
    if(WALLET.WalletOpen===false)
    {
        var StrErr="Not open wallet";
        ToLogClient(StrErr)
        return {result:0,text:StrErr};
    }

    if(CompareArr(WALLET.PubKeyArr,global.DEVELOP_PUB_KEY)!==0)
    {
        var StrErr="Not developer key";
        ToLogClient(StrErr)
        return {result:0,text:StrErr};
    }
    return true;
}

HTTPCaller.SendECode=function (Param)
{
    var Node=FindNodeByAddr(Param.Addr,1);
    if(Node===undefined)
        return {result:0,text:"Node not found"};
    if(Node===false)
        return {result:0,text:"Node not active - reconnect"};


    var Ret=CheckCorrectDevKey();
    if(Ret!==true)
        return Ret;

    SERVER.SendECode(Param,Node);
    return {result:1,text:"Send"};
}


HTTPCaller.SetCheckPoint=function (BlockNum,Param2,Param3)
{
    var Ret=CheckCorrectDevKey();
    if(Ret!==true)
        return Ret;



    if(!BlockNum)
        BlockNum=SERVER.BlockNumDB;
    else
        BlockNum=parseInt(BlockNum);



    // var Block=SERVER.ReadBlockHeaderDB(BlockNum);
    // var SignArr=arr2(Block.Hash,GetArrFromValue(Block.BlockNum));
    // var Sign = secp256k1.sign(shabuf(SignArr), WALLET.KeyPair.getPrivateKey('')).signature;
    // global.CHECK_POINT={BlockNum:BlockNum,Hash:Block.Hash,Sign:Sign};
    if(SetCheckPointOnBlock(BlockNum))
        return {result:1,text:"Set check point on BlockNum="+BlockNum};
    else
        return {result:0,text:"Error on check point BlockNum="+BlockNum};
}
function SetCheckPointOnBlock(BlockNum)
{
    var Block=SERVER.ReadBlockHeaderDB(BlockNum);
    if(!Block)
        return 0;

    var SignArr=arr2(Block.Hash,GetArrFromValue(Block.BlockNum));
    var Sign = secp256k1.sign(shabuf(SignArr), WALLET.KeyPair.getPrivateKey('')).signature;
    global.CHECK_POINT={BlockNum:BlockNum,Hash:Block.Hash,Sign:Sign};

    //clear Node.NextPing
    SERVER.ResetNextPingAllNode();
    return 1;
}
global.SetCheckPointOnBlock=SetCheckPointOnBlock;


var idSetTimeSetCheckPoint;
HTTPCaller.SetAutoCheckPoint=function (bSet)
{
    var Ret=CheckCorrectDevKey();
    if(Ret!==true)
        return Ret;


    if(idSetTimeSetCheckPoint)
        clearInterval(idSetTimeSetCheckPoint);
    idSetTimeSetCheckPoint=undefined;
    if(bSet)
        idSetTimeSetCheckPoint=setInterval(RunSetCheckPoint,2000);


    return {result:1,text:"AutoCheck: "+bSet};
}




var SumCheckPow=0;
var CountCheckPow=0;
function  RunSetCheckPoint()
{
    if(!SERVER.BlockNumDB)
        return;
    if(SERVER.BlockNumDB<2100000)
        return;
    var Delta=GetCurrentBlockNumByTime()-SERVER.BlockNumDB;
    if(Delta>16)
        return;

    var BlockNum=SERVER.BlockNumDB-global.CheckPointDelta;
    var Block=SERVER.ReadBlockHeaderDB(BlockNum);
    if(Block)
    {
        var Power=GetPowPower(Block.Hash);
        if(Power<16)
        {
            ToLog("CANNOT SET CHECK POINT Power="+Power+"  BlockNum="+BlockNum);
            return;
        }

        CountCheckPow++;
        SumCheckPow+=Power;
        var AvgPow=SumCheckPow/CountCheckPow;
        if(CountCheckPow>10)
        {
            if(Power<AvgPow-1)
            {
                ToLog("**************** CANNOT SET CHECK POINT Power="+Power+"/"+AvgPow+"  BlockNum="+BlockNum);
                return;
            }
        }

        SetCheckPointOnBlock(BlockNum);
        ToLog("SET CHECK POINT Power="+Power+"/"+AvgPow+"  BlockNum="+BlockNum);
    }
}


HTTPCaller.SetNewCodeVersion=function (Data)
{
    var Ret=CheckCorrectDevKey();
    if(Ret!==true)
        return Ret;


    var Ret=SERVER.SetNewCodeVersion(Data,WALLET.KeyPair.getPrivateKey(''));

    SERVER.ResetNextPingAllNode();

    return {result:1,text:Ret};
}



HTTPCaller.SetCheckDeltaTime=function (Data)
{
    var Ret=CheckCorrectDevKey();
    if(Ret!==true)
        return Ret;

    if(!Data || !Data.Num)
    {
        ToLogClient("Num not set")
        return {result:0};
    }

    var SignArr=SERVER.GetSignCheckDeltaTime(Data);
    Data.Sign = secp256k1.sign(shabuf(SignArr), WALLET.KeyPair.getPrivateKey('')).signature;
    global.CHECK_DELTA_TIME=Data;

    SERVER.ResetNextPingAllNode();

    return {result:1,text:"Set check time Num="+Data.Num};
}


var idAutoCorrTime;
HTTPCaller.SetAutoCorrTime=function (bSet)
{
    var Ret=CheckCorrectDevKey();
    if(Ret!==true)
        return Ret;


    if(idAutoCorrTime)
        clearInterval(idAutoCorrTime);
    idAutoCorrTime=undefined;
    if(bSet)
        idAutoCorrTime=setInterval(RunAutoCorrTime,1000);


    return {result:1,text:"Auto correct: "+bSet};
}

var StartCheckTimeNum=0;
function RunAutoCorrTime()
{
    if(WALLET.WalletOpen===false)
        return;

    if(GetCurrentBlockNumByTime()>StartCheckTimeNum && Math.abs(global.DELTA_CURRENT_TIME)>150)
    {
        var AutoDelta=-Math.trunc(global.DELTA_CURRENT_TIME);
        var Data={Num:GetCurrentBlockNumByTime(),bUse:1,bAddTime:1};
        if(AutoDelta<0)
        {
            AutoDelta=-AutoDelta;
            Data.bAddTime=0;
        }
        Data.DeltaTime=50;
        Data.StartBlockNum=Data.Num+5;
        Data.EndBlockNum=Data.StartBlockNum+Math.trunc(AutoDelta/Data.DeltaTime);


        var SignArr=SERVER.GetSignCheckDeltaTime(Data);
        Data.Sign = secp256k1.sign(shabuf(SignArr), WALLET.KeyPair.getPrivateKey('')).signature;
        global.CHECK_DELTA_TIME=Data;

        SERVER.ResetNextPingAllNode();

        StartCheckTimeNum=Data.EndBlockNum+1;
        ToLog("Auto corr time Num:"+Data.Num+" AutoDelta="+AutoDelta);
        //ToLog(JSON.stringify(Data));

    }
}





HTTPCaller.SaveConstant=function (SetObj)
{
    for(var key in SetObj)
    {
        global[key]=SetObj[key];
    }
    SAVE_CONST(true);
    SERVER.DO_CONSTANT();




    if(SetObj.DoRestartNode)
        global.RestartNode();
    else
    {
        if(SetObj.DoMining)
            global.RunStopPOWProcess();

    }

    return {result:1};
}

HTTPCaller.SetHTTPParams=function (SetObj)
{
    global.HTTP_PORT_NUMBER=SetObj.HTTPPort;
    global.HTTP_PORT_PASSWORD=SetObj.HTTPPassword;
    SAVE_CONST(true);


    if(SetObj.DoRestartNode)
        global.RestartNode();

    return {result:1};
}

HTTPCaller.SetNetMode=function (SetObj)
{
    if(!global.NET_WORK_MODE)
        global.NET_WORK_MODE={};

    for(var key in SetObj)
    {
        global.NET_WORK_MODE[key]=SetObj[key];
    }
    if(NET_WORK_MODE)
    {
        global.START_IP=NET_WORK_MODE.ip;
        global.START_PORT_NUMBER=NET_WORK_MODE.port;
    }

    SAVE_CONST(true);


    if(SetObj.DoRestartNode)
        global.RestartNode();

    return {result:1};
}


//TEST TEST

HTTPCaller.GetAccountKey=function (Num)
{
    var Result={};
    Result.result=0;

    var KeyPair=WALLET.GetAccountKey(Num);
    if(KeyPair)
    {
        Result.result=1;
        Result.PubKeyStr=GetHexFromArr(KeyPair.getPublicKey('','compressed'));
    }
    return Result;
}

//HOT TREE
HTTPCaller.GetHotArray=function ()
{
    //Hot
    var ArrTree=SERVER.TransferTree;
    if(!ArrTree)
        return {result:0};

    for(var Level=0;Level<ArrTree.length;Level++)
    {
        var arr=ArrTree[Level];
        if(!arr)
            continue;

        arr.sort(SortNodeHot);
        for(var n=0;n<arr.length;n++)
        {
            arr[n]=GetCopyNode(arr[n]);
        }
    }


    function SortNodeHot(a,b)
    {
        if(b.Hot!==a.Hot)
            return b.Hot-a.Hot;
        if(b.BlockProcessCount!==a.BlockProcessCount)
            return b.BlockProcessCount-a.BlockProcessCount;

        if(a.DeltaTime!==b.DeltaTime)
            return a.DeltaTime-b.DeltaTime;

        return a.id-b.id;

    }


    return {result:1,ArrTree:ArrTree};
}
function GetCopyNode(Node)
{
    if(!Node)
        return;

    if(Node.Socket && Node.Socket.Info)
    {
        Node.Info+=Node.Socket.Info+"\n";
        Node.Socket.Info="";
    }
    if(!Node.PrevInfo)
        Node.PrevInfo="";

    var Item=
        {
            Level:Node.Level,
            VersionNum:Node.VersionNum,
            LevelCount:Node.LevelCount,
            ip:Node.ip,
            port:Node.port,
            Name:Node.Name,
            addrStr:Node.addrStr,
            BlockProcessCount:Node.BlockProcessCount,
            Delta:Node.DeltaTime,
            CanHot:Node.CanHot,
            Active:Node.Active,
            Hot:Node.Hot,
            Stage:Node.Stage,
            id:Node.id,
            Info:Node.PrevInfo+Node.Info,
            InConnectArr:Node.WasAddToConnect,
        };

    return Item;
}


//STATS

HTTPCaller.GetBlockchainStat=function (Param)
{
    var Result=SERVER.GetStatBlockchainPeriod(Param.BlockNum,Param.Count,Param.Miner,Param.Adviser);
    Result.result=1;
    Result.sessionid=sessionid;
    return Result;
}

HTTPCaller.GetAllCounters=function (SetObj)
{
    var Result=GET_STATS();
    Result.result=1;
    Result.sessionid=sessionid;
    Result.STAT_MODE=global.STAT_MODE;
    return Result;
}
HTTPCaller.SetStatMode=function (flag)
{
    if(flag)
        StartCommonStat();

    global.STAT_MODE=flag;
    SAVE_CONST(true);
    return {result:1,sessionid:sessionid,STAT_MODE:global.STAT_MODE};
}
HTTPCaller.ClearStat=function (flag)
{
    global.ClearCommonStat();
    return {result:1,sessionid:sessionid,STAT_MODE:global.STAT_MODE};
}



HTTPCaller.CleanChain=function (StartNum)
{
    global.SendLogToClient=1;
    if(global.CleanChain)
        global.CleanChain(StartNum);
    global.SendLogToClient=0;
    return {result:1,sessionid:sessionid};
}

HTTPCaller.RewriteTransactions=function (Param)
{
    global.SendLogToClient=1;
    SERVER.ReWriteDAppTransactions(Param.StartNum,Param.EndNum);
    global.SendLogToClient=0;
    return {result:1,sessionid:sessionid};
}



HTTPCaller.CheckBlocks=function (StartNum)
{
    if(!StartNum)
        StartNum=0;
    global.SendLogToClient=1;
    SERVER.CheckBlocksOnStartFoward(StartNum,0);
    global.SendLogToClient=0;
    return {result:1,sessionid:sessionid};
}


//MONITOR
HTTPCaller.GetNodes=function ()
{
    var ArrNodes=SERVER.GetActualNodes();

    var res=[];
    for(var Node of ArrNodes)
    {
        res.push({ip:Node.ip,port:Node.port,webport:80,addr:Node.addrStr,Hot:Node.Hot,Active:Node.Active});
    }

    var Result=
        {
            result:1,
            sessionid:sessionid,
            Nodes:res,
            DEF_NETWORK:GetNetworkName(),
            DEF_VERSION:DEF_VERSION,
            port:SERVER.port,
            webport:global.HTTP_PORT_NUMBER,
        };
    return Result;
}



//DIAGRAMS

HTTPCaller.GetArrStats=function (Keys)
{
    var arr=GET_STATDIAGRAMS(Keys);
    return {result:1,sessionid:sessionid,arr:arr,STAT_MODE:global.STAT_MODE};
}


//BLOCK CHAIN MONITOR

HTTPCaller.GetBlockChain=function (type)
{
     if(!global.SERVER || !SERVER.LoadedChainList)
    {
        return {result:0};
    }

    var MainChains={};
    for(var i=0;i<SERVER.LoadedChainList.length;i++)
    {
        var chain=SERVER.LoadedChainList[i];
        if(chain && !chain.Deleted)
            MainChains[chain.id]=true;
    }

    var arrBlocks=[];
    var arrLoadedChainList=[];
    var arrLoadedBlocks=[];
    //for(var Block of SERVER.BlockChain)
    for(var key in SERVER.BlockChain)
    {
        var Block=SERVER.BlockChain[key];
        if(Block)
        {
            arrBlocks.push(CopyBlockDraw(Block,MainChains));
        }
    }





    AddChainList(arrLoadedChainList,SERVER.LoadedChainList,true);
    AddMapList(arrLoadedBlocks,type,SERVER.MapMapLoaded,MainChains);

    var ArrLoadedChainList=SERVER.HistoryBlockBuf.LoadValue("LoadedChainList",1);
    if(ArrLoadedChainList)
        for(var List of ArrLoadedChainList)
        {
            AddChainList(arrLoadedChainList,List);
        }

    var ArrMapMapLoaded=SERVER.HistoryBlockBuf.LoadValue("MapMapLoaded",1);
    if(ArrMapMapLoaded)
        for(var List of ArrMapMapLoaded)
        {
            AddMapList(arrLoadedBlocks,type,List);
        }


    var obj=
        {
            CurrentBlockNum:SERVER.CurrentBlockNum,
            LoadedChainList:arrLoadedChainList,
            LoadedBlocks:arrLoadedBlocks,
            BlockChain:arrBlocks,
            port:SERVER.port,
            DELTA_CURRENT_TIME:DELTA_CURRENT_TIME,
            memoryUsage:process.memoryUsage(),
            IsDevelopAccount:(CompareArr(WALLET.PubKeyArr,global.DEVELOP_PUB_KEY)===0),
            LoadedChainCount:SERVER.LoadedChainList.length,
            StartLoadBlockTime:SERVER.StartLoadBlockTime,
            sessionid:sessionid,
            result:1
        };

    arrBlocks=[];
    arrLoadedChainList=[];
    arrLoadedBlocks=[];

    return obj;
}





//Others

//**********************************************************************************************************************
//**********************************************************************************************************************
//**********************************************************************************************************************


function CreateDump(response)
{
    response.writeHead(200, { 'Content-Type': 'application/json','Access-Control-Allow-Origin':'*'});
    response.writeHead(200, { 'Content-Type': 'application/json' });

    // require('../EXPERIMENTAL/heapdump');
    // MemDump();

    var Result=
        {
            result:1,
            sessionid:sessionid,
        };
    response.end(JSON.stringify(Result));
}

//----------------------------------------------------------------------------------------------------------------------

//проверка константы global.USE_PACKET_STAT
setInterval(function ()
{
    if(global.USE_PACKET_STAT)
    {
        if(!global.USE_PACKET_STAT_TIME)
            global.USE_PACKET_STAT=0;
        else
        {
            var Time = process.hrtime(global.USE_PACKET_STAT_TIME);
            var deltaTime=Math.floor(Time[0]*1000 + Time[1]/1e6);//ms
            if(deltaTime>500*1000)
            {
                SERVER.ArrPacketStat=[];
                global.USE_PACKET_STAT=0;
            }
        }
    }
},500*1000);



function GetNetParams(response)
{
    response.writeHead(200, { 'Content-Type': 'application/json','Access-Control-Allow-Origin':'*'});
    response.writeHead(200, { 'Content-Type': 'application/json' });

    var Result=
        {
            result:1,
            sessionid:sessionid,
            CurBlockNum:GetCurrentBlockNumByTime(),
            StartDateBlock:FIRST_TIME_BLOCK,
            addrArr:SERVER.addrArr,
            ip:SERVER.ip,
            port:SERVER.port,
            DEF_NETWORK:GetNetworkName(),
            DEF_VERSION:DEF_VERSION,
            DEF_CLIENT:DEF_CLIENT,
            CONSENSUS_PERIOD_TIME:CONSENSUS_PERIOD_TIME,
            BLOCK_PROCESSING_LENGTH:BLOCK_PROCESSING_LENGTH
        };
    response.end(JSON.stringify(Result));
}

//----------------------------------------------------------------------------------------------------------------------
function GetBlockHeaders(response)
{
    response.writeHead(200, { 'Content-Type': 'application/json','Access-Control-Allow-Origin':'*'});
    response.writeHead(200, { 'Content-Type': 'application/json' });

    var Block,Result;
    var MaxNum=SERVER.CurrentBlockNum;
    var arr=[];
    for(var i=0;i<BLOCK_PROCESSING_LENGTH*2;i++)
    {
        var BlockNum=MaxNum-BLOCK_PROCESSING_LENGTH*2+i;
        Block=SERVER.GetBlock(BlockNum,false);
        if(Block)
        {
            arr.push(GetCopyBlock(Block));
        }
    }

    var Result={};
    Result.ArrBlocks=arr;
    Result.result=1;
    Result.sessionid=sessionid;
    response.end(JSON.stringify(Result));
}

function GetBlockData(response,BlockNum)
{
    response.writeHead(200, { 'Content-Type': 'application/json','Access-Control-Allow-Origin':'*'});
    response.writeHead(200, { 'Content-Type': 'application/json' });

    var Block,Result;
    var MaxNum=SERVER.CurrentBlockNum;
    if(BlockNum!==undefined)
    {
        BlockNum=parseInt(BlockNum);
        if(BlockNum>MaxNum-BLOCK_PROCESSING_LENGTH)
        {
            Block=SERVER.GetBlock(BlockNum,false);
            // if(Block && !Block.arrContent)
            //     Block=undefined;
        }
        else
        if(BlockNum===0 || BlockNum>0 || BlockNum<=MaxNum)
        {
            Block=SERVER.ReadBlockDB(BlockNum);
        }
    }

    if(Block)
    {
        Result=GetCopyBlock(Block);
        Result.result=1;
    }
    else
    {
        Result=
        {
            result:0,
        };
    }
    Result.sessionid=sessionid;
    response.end(JSON.stringify(Result));
}
function GetCopyBlock(Block)
{
    var Result=
        {
            BlockNum:Block.BlockNum,
            bSave:Block.bSave,
            TreeHash:GetHexFromAddres(Block.TreeHash),
            AddrHash:GetHexFromAddres(Block.AddrHash),
            PrevHash:GetHexFromAddres(Block.PrevHash),
            SumHash:GetHexFromAddres(Block.SumHash),

            SumPow:Block.SumPow,
            TrDataPos:Block.TrDataPos,
            TrDataLen:Block.TrDataLen,
            SeqHash:GetHexFromAddres(Block.SeqHash),
            Hash:GetHexFromAddres(Block.Hash),
            Power:GetPowPower(Block.Hash),

            TrCount:Block.TrCount,
            arrContent:Block.arrContent,

        };
    return Result;
}
//----------------------------------------------------------------------------------------------------------------------



//----------------------------------------------------------------------------------------------------------------------




//**********************************************************************************************************************
//**********************************************************************************************************************



var AddrLength=16;
function GetHexFromAddresShort(Hash)
{
    return GetHexFromAddres(Hash).substr(0,AddrLength);
}
function GetHexFromStrShort(Str)
{
    if(Str===undefined)
        return Str;
    else
        return Str.substr(0,AddrLength);
}

var glid=0;
function GetGUID(Block)
{
    if(!Block)
        return "------";
    if(!Block.guid)
    {
        glid++;
        Block.guid=glid;
    }
    return Block.guid;
}
function CopyBlockDraw(Block,MainChains)
{
    var MinerID=0;
    if(Block.AddrHash)
    {
        //Block.AddrHash.len=0;
        var Num=ReadUintFromArr(Block.AddrHash,0);
        var Item=DApps.Accounts.ReadState(Num);
        if(Item && Item.Description)
            MinerID=Item.Description.substr(0,8);
        else
            MinerID=Num;

    }

    var CheckPoint=0;
    if(Block.BlockNum===CHECK_POINT.BlockNum)
        CheckPoint=1;

    var Mining;
    if(SERVER.MiningBlock===Block)
        Mining=1;
    else
        Mining=0;


    GetGUID(Block);
    var Item=
        {
            guid:Block.guid,
            Active:Block.Active,
            bSave:Block.bSave,
            Prepared:Block.Prepared,
            BlockNum:Block.BlockNum,
            Hash:GetHexFromAddresShort(Block.Hash),
            SumHash:GetHexFromAddresShort(Block.SumHash),
            SeqHash:GetHexFromAddresShort(Block.SeqHash),
            TreeHash:GetHexFromAddresShort(Block.TreeHash),
            AddrHash:GetHexFromAddresShort(Block.AddrHash),
            Miner1:MinerID,
            Comment1:Block.Comment1,
            Comment2:Block.Comment2,
            SumPow:Block.SumPow,
            Info:Block.Info,
            TreeLoaded:Block.TreeEq,
            AddToLoad:Block.AddToLoad,
            LoadDB:Block.LoadDB,
            FindBlockDB:Block.FindBlockDB,
            TrCount:Block.TrCount,
            ArrLength:0,
            TrDataLen:Block.TrDataLen,
            Power:GetPowPower(Block.Hash),
            CheckPoint:CheckPoint,
            Mining:Mining,

        };
    if(Block.chain)
        Item.chainid=Block.chain.id;
    if(Block.LoadDB!==undefined)
       Item.bSave=Block.LoadDB;
    if(Block.arrContent)
        //Item.ArrLength=Block.arrContent.length;
        Item.TrCount=Block.arrContent.length;


    Item.BlockDown=GetGUID(Block.BlockDown);

    if(MainChains && Item.chainid)
    {
        Item.Main=MainChains[Item.chainid];
    }

    return Item;
}
function CopyChainDraw(Chain,bWasRecursive,bMain)
{
    if(!Chain)
        return Chain;

    GetGUID(Chain);


    var Item=
        {
            guid:Chain.guid,
            id:Chain.id,
            chainid:Chain.id,
            bSave:Chain.LoadDB,
            FindBlockDB:Chain.FindBlockDB,
            GetFindDB:Chain.GetFindDB(),
            BlockNum:Chain.BlockNumStart,
            Hash:GetHexFromAddresShort(Chain.HashStart),
            Comment1:Chain.Comment1,
            Comment2:Chain.Comment2,
            StopSend:Chain.StopSend,
            SumPow:0,
            Info:Chain.Info,
            IsSum:Chain.IsSum,
            //Error:Chain.GetRootChain(Chain).Error,
            Main:bMain,
            //num:Chain.num,
            // CountForLoad:Chain.CountForLoad,
            // CountWasLoad:Chain.CountWasLoad,
        };
    if(Chain.IsSumStart)
    {
        Item.SumHash=Item.Hash;
        Item.Hash="-------";
    }
    if(Chain.RootChain)
    {
        var rootChain=Chain.GetRootChain();
        Item.rootid=rootChain.id;
        if(!bWasRecursive)
            Item.root=CopyChainDraw(rootChain,true);
        //Item.RootInfo=rootChain.Info;
    }
    else
        Item.rootid="";
    if(Chain.BlockHead)
    {
        Item.HashMaxStr=GetGUID(Chain.BlockHead);
        Item.BlockNumMax=Chain.BlockHead.BlockNum;
    }
    else
    {
        Item.HashMaxStr="------";
    }




    return Item;
}

function AddChainList(arrLoadedChainList,LoadedChainList,bMain)
{
    for(var chain of LoadedChainList)
    {
        if(chain)
        {
            arrLoadedChainList.push(CopyChainDraw(chain,false,bMain));
        }
    }
}
function AddMapList(arrLoadedBlocks,type,MapMapLoaded,MainChains)
{
    for(var key in MapMapLoaded)
    {
        var map=MapMapLoaded[key];
        if(map)
        {
            for(var key in map)
            {
                var Block=map[key];
                 if(key.substr(1,1)===":")
                    continue;

                if(!Block.Send || type==="reload")
                {
                    arrLoadedBlocks.push(CopyBlockDraw(Block,MainChains));
                    Block.Send=true;
                }
            }
        }
    }
}


function SendFileHTML(response,name,StrCookie)
{
    let type=name.substr(name.length-3,3);




    fs.readFile("./"+name, function read(err, data)
    {
        if (err)
        {
            if(type==="ico")
            {
                response.writeHead(404, { 'Content-Type': 'text/html'});
                response.end();
                return;
            }


            ToError(err);
            data="Not found: "+name;
        }
        else
        {
            switch (type)
            {
                case ".js":
                    response.writeHead(200, { 'Content-Type': 'application/javascript'});
                    break;
                case "css":
                    response.writeHead(200, { 'Content-Type': 'text/css'});
                    break;
                case "wav":
                    response.writeHead(200, { 'Content-Type': 'audio/wav'});
                    break;
                case "mp3":
                    response.writeHead(200, { 'Content-Type': 'audio/mpeg'});
                    break;
                case "ico":
                    response.writeHead(200, { 'Content-Type': 'image/vnd.microsoft.icon'});
                    break;
                case "png":
                    response.writeHead(200, { 'Content-Type': 'image/png'});
                    break;
                case "gif":
                    response.writeHead(200, { 'Content-Type': 'image/gif'});
                    break;
                case "jpg":
                    response.writeHead(200, { 'Content-Type': 'image/jpeg'});
                    break;
                default:
                    if(StrCookie)
                        response.writeHead(200, { 'Set-Cookie': StrCookie, 'Content-Type': 'text/html'});
                    else
                        response.writeHead(200, { 'Content-Type': 'text/html'});
                    break;
            }
         }

        response.end(data);
    });
}


//**********************************************************************************************************************
// function GetArrFromHexTr(Str)
// {
//     let array=Buffer.alloc(Str.length/2);
//     for(let i=0;i<array.length;i++)
//     {
//         array[i]=parseInt(Str.substr(i*2,2),16);
//     }
//     return array;
// }
//**********************************************************************************************************************
function GetStrTime()
{
    var now = GetCurrentTime(0);
    var Str=""+now.getHours().toStringZ(2);
    Str=Str+":"+now.getMinutes().toStringZ(2);
    Str=Str+":"+now.getSeconds().toStringZ(2);
    return Str;
}


//TRANSFER DATA (CLIENT-SERVER)
function OnGetData(arg)
{
    var Path=arg.path;
    var obj=arg.obj;

    var params=Path.split('/',5);
    params.splice(0,1);


    var Ret;
    var F=HTTPCaller[params[0]];
    if(F)
    {

        if(obj)
            Ret=F(obj);
        else
            Ret=F(params[1],params[2],params[3]);
    }
    else
    {
        Ret={result:0};
    }
    return Ret;
}

//RUN HTTP SERVER
function parseCookies (rc)
{
    var list = {};

    rc && rc.split(';').forEach(function( cookie )
    {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });

    return list;
}
if(global.HTTP_PORT_NUMBER)
{
    var ClientTokenMap={};
    var ClientIPMap={};
    setInterval(function ()
    {
        ClientTokenMap={};
    },24*3600*1000);

    var port = global.HTTP_PORT_NUMBER;
    var HTTPServer=http.createServer(function (request, response0)
    {
        if(!request.headers)
            return;
        if(!request.socket || !request.socket.remoteAddress)
            return;


        if(!global.HTTP_PORT_PASSWORD && request.socket.remoteAddress.indexOf("127.0.0.1")<0)
             return;

        let RESPONSE=response0;
        var response=
            {
                end:function (data)
                {
                    try{RESPONSE.end(data);}catch(e){ToError("H##1");ToError(e);}
                },
                writeHead:function (num, data)
                {
                    try{RESPONSE.writeHead(num,data);}catch(e){ToError("H##2");ToError(e);}
                },
            };

        if(!global.SERVER)
        {
            response.writeHead(404, { 'Content-Type': 'text/html'});
            response.end("");
            return;
        }

        var fromURL = url.parse(request.url);
        var Path=querystring.unescape(fromURL.path);

        if(!ClientIPMap[request.socket.remoteAddress])
        {
            ClientIPMap[request.socket.remoteAddress]=1;
            ToLog("CONNECT TO HTTP ACCESS FROM: "+request.socket.remoteAddress);
            ToLog("Path: "+Path);
        }

        if(global.HTTP_PORT_PASSWORD)
        {
            var cookies = parseCookies(request.headers.cookie);
            if(cookies.token && cookies.hash && ClientTokenMap[cookies.token]===0)
            {
                if(cookies.hash.substr(0,4)!=="0000")
                {
                    //ToLog("NOT POW hash="+cookies.hash+" from: "+request.socket.remoteAddress);
                    SendFileHTML(response,"./HTML/password.html","token="+cookies.token+";path=/");
                    return;
                }

                var nonce=0;
                var index=cookies.hash.indexOf("-");
                if(index>0)
                {
                    nonce=parseInt(cookies.hash.substr(index+1));
                    if(!nonce)
                        nonce=0;
                }

                var hash=ClientHex(cookies.token+"-"+global.HTTP_PORT_PASSWORD,nonce);
                if(hash===cookies.hash)
                {
                    ClientTokenMap[cookies.token]=1;
                }
                else
                {
                    SendFileHTML(response,"./HTML/password.html","token="+cookies.token+";path=/");
                    return;
                }
            }

            //ToLog(""+request.method+"   path: "+Path+"  cookies:"+JSON.stringify(cookies));

            if(!cookies.token || !ClientTokenMap[cookies.token])
            {
                var StrToken=GetHexFromArr(crypto.randomBytes(16));
                ClientTokenMap[StrToken]=0;
                SendFileHTML(response,"./HTML/password.html","token="+StrToken+";path=/");
                return;
            }
        }


        var params=Path.split('/',6);
        params.splice(0,1);


        var Type=request.method;
        if(Type==="POST")
        {
            let Response=response;
            let Params=params;
            let postData = "";
            request.addListener("data",
                function(postDataChunk)
                {
                    postData += postDataChunk;
                });

            request.addListener("end",
                function()
                {
                    var Data;
                    try
                    {
                        Data=JSON.parse(postData)
                    }
                    catch (e)
                    {
                        ToError("--------Error data parsing : "+Params[0]+" "+postData.substr(0,200))
                        Response.writeHead(405, { 'Content-Type': 'text/html'});
                        Response.end("Error data parsing");

                    }
                    DoCommand(response,Path,[Params[0],Data]);
                });

        }
        else
        {
            DoCommand(response,Path,params);
        }

    }).listen(port);
    ToLog("Run HTTP-server on port:"+port);


    HTTPServer.on('error', (err) =>
    {
        ToError("H##3");
        ToError(err);
    });
}

if(global.ELECTRON)
{
    const {ipcMain} = require('electron');

    ipcMain.on('GetData', (event, arg) =>
    {
        event.returnValue = OnGetData(arg);
    })
}
exports.SendData = OnGetData;

function RunConsole(StrRun)
{
    var Str = fs.readFileSync("./EXPERIMENTAL/!run-console.js",{encoding : "utf8"});
    if(StrRun)
        Str+="\n"+StrRun;

    try
    {
        var ret=eval(Str);
    }
    catch (e)
    {
        //ret=""+e;
        ret=e.message+"\n"+e.stack;
    }
    return ret;
}


//GetHexFromArr

