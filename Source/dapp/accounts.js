"use strict";
/*
 * DATA RIVER project
 * Copyright: Yuriy Ivanov, 2017-2018, e-mail: progr76@gmail.com
*/

const fs = require('fs');
const DBRow=require("../core/db/db-row");

const MAX_SUM_TER=1e9;
const MAX_SUM_CENT=1e9;



var code_base=' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\x7f\u0402\u0403\u201a\u0453\u201e\u2026\u2020\u2021\u20ac\u2030\u0409\u2039\u040a\u040c\u040b\u040f\u0452\u2018\u2019\u201c\u201d\u2022\u2013\u2014\ufffd\u2122\u0459\u203a\u045a\u045c\u045b\u045f\xa0\u040e\u045e\u0408\xa4\u0490\xa6\xa7\u0401\xa9\u0404\xab\xac\xad\xae\u0407\xb0\xb1\u0406\u0456\u0491\xb5\xb6\xb7\u0451\u2116\u0454\xbb\u0458\u0405\u0455\u0457\u0410\u0411\u0412\u0413\u0414\u0415\u0416\u0417\u0418\u0419\u041a\u041b\u041c\u041d\u041e\u041f\u0420\u0421\u0422\u0423\u0424\u0425\u0426\u0427\u0428\u0429\u042a\u042b\u042c\u042d\u042e\u042f\u0430\u0431\u0432\u0433\u0434\u0435\u0436\u0437\u0438\u0439\u043a\u043b\u043c\u043d\u043e\u043f\u0440\u0441\u0442\u0443\u0444\u0445\u0446\u0447\u0448\u0449\u044a\u044b\u044c\u044d\u044e\u044f';


global.MAX_ACT_ROW_LENGTH=TRANSACTION_PROOF_COUNT*2;//130Mb (for proof=1 млн)

const TYPE_TRANSACTION_CREATE=100;
//const TYPE_TRANSACTION_CHANGE=102;
const TYPE_TRANSACTION_TRANSFER=105;
const TYPE_TRANSACTION_TRANSFER2=110;
global.TYPE_TRANSACTION_ACC_HASH=117;

global.FORMAT_CREATE=
    "{\
    Type:byte,\
    Currency:uint,\
    PubKey:arr33,\
    Description:str40,\
    Adviser:uint,\
    Reserve:arr7,\
    }";//1+6+33+40+6+7=93


global.FORMAT_MONEY_TRANSFER=
    "{\
    Type:byte,\
    Currency:uint,\
    FromID:uint,\
    To:[{ID:uint,SumTER:uint,SumCENT:uint32}],\
    Description:str,\
    OperationID:uint,\
    Sign:arr64,\
    }";//1+6+6+4+2+16*N+64=87+16*N + str
const WorkStructTransfer={};
global.FORMAT_MONEY_TRANSFER_BODY=FORMAT_MONEY_TRANSFER.replace("Sign:arr64,","");


global.FORMAT_MONEY_TRANSFER2=
    "{\
    Type:byte,\
    Version:byte,\
    Currency:uint,\
    FromID:uint,\
    To:[{ID:uint,SumTER:uint,SumCENT:uint32}],\
    Description:str,\
    OperationID:uint,\
    Sign:arr64,\
    }";//1+6+6+4+2+16*N+64=87+16*N + str
const WorkStructTransfer2={};
global.FORMAT_MONEY_TRANSFER_BODY2=FORMAT_MONEY_TRANSFER2.replace("Sign:arr64,","");


global.FORMAT_ACCOUNT_HASH=
    "{\
    Type:byte,\
    BlockNum:uint,\
    Hash:buffer32,\
    }";


class MerkleDBRow extends DBRow
{
    constructor(FileName,DataSize,Format)
    {
        super(FileName,DataSize,Format);

        this.MerkleTree;
        this.MerkleArr=[];
        this.MerkleCalc=[];
    }
    CalcMerkleTree()
    {
        if(!this.MerkleTree)
        {
            this.MerkleTree={LevelsArr:[this.MerkleArr],LevelsCalc:[this.MerkleCalc],RecalcCount:0};
            for(var num=0;num<=this.GetMaxNum();num++)
            {
                var Buf=this.Read(num,1);
                this.MerkleArr[num]=shaarr(Buf);
                this.MerkleCalc[num]=0;
            }
        }

        this.MerkleTree.RecalcCount=0;
        UpdateMerklTree(this.MerkleTree,0);



        return this.MerkleTree.Root;

    }

    Write(Data)
    {
        var RetBuf={};
        var bRes=DBRow.prototype.Write.call(this, Data, RetBuf);
        if(bRes)
        {
            var Hash=shaarr(RetBuf.Buf);
            this.MerkleArr[Data.Num]=Hash;
            this.MerkleCalc[Data.Num]=0;
        }
        return bRes;
    }
    Truncate(LastNum)
    {
        DBRow.prototype.Truncate.call(this, LastNum);
        this.MerkleArr.length=LastNum+1;
        this.MerkleCalc.length=LastNum+1;
    }
};


//codes updater
class AccountApp extends require("./dapp")
{
    constructor()
    {
        super();

        //DB-state (база состояний)
        this.FORMAT_ACCOUNT_ROW=
            "{\
            Currency:uint,\
            PubKey:arr33,\
            Description:str40,\
            Value:{SumTER:uint,SumCENT:uint32, OperationID:uint,Reserve:arr84},\
            BlockNumCreate:uint,\
            Adviser:uint,\
            Reserve:arr9,\
            }";

        this.ACCOUNT_ROW_SIZE=6+33 + 40+(6+4 +6+84) + 6+6+9;
        this.DBState=new MerkleDBRow("accounts-state",this.ACCOUNT_ROW_SIZE,this.FORMAT_ACCOUNT_ROW);
        //this.DBState=new DBRow("accounts-state",this.ACCOUNT_ROW_SIZE,this.FORMAT_ACCOUNT_ROW);

        //DB-act (база движений)
        this.DBAct=new DBRow("accounts-act",6+6 + (6+4+6+6+84) + 1 + 11,"{ID:uint, BlockNum:uint,PrevValue:{SumTER:uint,SumCENT:uint32, BlockNum:uint, OperationID:uint,Reserve:arr84}, Mode:byte, Reserve: arr11}");
        this.DBActPrev=new DBRow("accounts-act-prev",this.DBAct.DataSize,this.DBAct.Format);


        //DB-хешей по таблице остатков
        this.DBAccountsHash=new DBRow("accounts-hash",6+32 +12,"{BlockNum:uint,Hash:hash, Reserve: arr12}");


        this.Start();

        setInterval(this.ControlActSize.bind(this),60*1000);

        //TODO NET TRANSFER
    }


    Start()
    {
        if(this.DBState.GetMaxNum()+1>=BLOCK_PROCESSING_LENGTH2)
            return;

        //genesis state
        this.DBState.Write({Num:0,PubKey:[],Value:{BlockNum:1,SumTER:0.95*TOTAL_TER_MONEY},Description:"System account"});
        for(var i=1;i<8;i++)
            this.DBState.Write({Num:i,PubKey:[],Value:{BlockNum:1},Description:""});

        this.DBState.Write({Num:8,PubKey:GetArrFromHex(ARR_PUB_KEY[0]),Value:{BlockNum:1,SumTER:0.05*TOTAL_TER_MONEY},Description:"Founder account"});
        this.DBState.Write({Num:9,PubKey:GetArrFromHex(ARR_PUB_KEY[1]),Value:{BlockNum:1,SumTER:0},Description:"Developer account"});
        for(var i=10;i<BLOCK_PROCESSING_LENGTH2;i++)
            this.DBState.Write({Num:i,PubKey:GetArrFromHex(ARR_PUB_KEY[i-8]),Value:{BlockNum:1},Description:""});

        ToLog("MAX_NUM:"+this.DBState.GetMaxNum());
    }
    ControlActSize()
    {
        //
        var MaxNum=this.DBAct.GetMaxNum();
        if(MaxNum>=MAX_ACT_ROW_LENGTH)
        {
            ToLog("Rename act files");
            this.DBActPrev.CloseDBFile(this.DBActPrev.FileName);
            this.DBAct.CloseDBFile(this.DBAct.FileName);

            //rename
            if(fs.existsSync(this.DBActPrev.FileNameFull))
            {
                fs.unlinkSync(this.DBActPrev.FileNameFull);
            }

            fs.renameSync(this.DBAct.FileNameFull,this.DBActPrev.FileNameFull);

            ToLog("MAX_NUM PREV:"+this.DBActPrev.GetMaxNum());
            ToLog("MAX_NUM CURR:"+this.DBAct.GetMaxNum());
        }
    }


    OnDeleteBlock(Block)
    {
        // if(Block.BlockNum<BLOCK_PROCESSING_LENGTH2)
        //     return;
        if(Block.BlockNum<1)
            return;
        this.DeleteAct(Block.BlockNum);
    }

    SendMoney(FromID,ToID,CoinSum,BlockNum,Description)
    {
        if(CoinSum.SumCENT>=1e9)
        {
            throw "ERROR SumCENT>=1e9"
        }


        var FromData=this.ReadValue(FromID);

        var OperationID=FromData.Value.OperationID;
        var TR=
            {
                FromID:FromID,
                To:[{ID:ToID,SumTER:CoinSum.SumTer,SumCENT:CoinSum.SumCent}],
                Description:Description,
                OperationID:OperationID
            };

        FromData.PrevValue=CopyObjValue(FromData.Value);
        FromData.ActDirect="-";
        FromData.ActSumTER=CoinSum.SumTER;
        FromData.ActSumCENT=CoinSum.SumCENT;
        var Result=this.SUB(FromData.Value,CoinSum);
        if(!Result)
            return false;
        FromData.Value.OperationID++;
        this.WriteValue(TR,FromData,BlockNum);

        var ToData=this.ReadValue(ToID);
        ToData.PrevValue=CopyObjValue(ToData.Value);
        ToData.ActDirect="+";
        ToData.ActSumTER=CoinSum.SumTER;
        ToData.ActSumCENT=CoinSum.SumCENT;
        this.ADD(ToData.Value,CoinSum);
        this.WriteValue(TR,ToData,BlockNum);
        return true;
    }


    OnWriteBlockStart(Block)
    {
        // if(Block.BlockNum<BLOCK_PROCESSING_LENGTH2)
        //     return;
        if(Block.BlockNum<1)
            return;
        this.OnDeleteBlock(Block);


    }

    OnWriteBlockFinish(Block)
    {
        //do coin base
        this.DoCoinBaseTR(Block);

        this.CalcHash(Block.BlockNum);
    }




    OnWriteTransaction(Body,BlockNum,TrNum)
    {
        var Type=Body[0];

        var Result;
        switch (Type)
        {
            case TYPE_TRANSACTION_CREATE:
            {
                Result=this.TRCreateAccount(Body,BlockNum);
                break;
            }

            // case TYPE_TRANSACTION_CHANGE:
            // {
            //     Result=this.TRChangeAccount(Body,BlockNum);
            //     break;
            // }

            case TYPE_TRANSACTION_TRANSFER:
            {
                Result=this.TRTransferMoney(Body,BlockNum,FORMAT_MONEY_TRANSFER,WorkStructTransfer);
                break;
            }
            case TYPE_TRANSACTION_TRANSFER2:
            {
                Result=this.TRTransferMoney(Body,BlockNum,FORMAT_MONEY_TRANSFER2,WorkStructTransfer2);
                break;
            }
            case TYPE_TRANSACTION_ACC_HASH:
            {
                var BlockNumHash=BlockNum-DELTA_BLOCK_ACCOUNT_HASH;
                Result=this.TRCheckAccountHash(Body,BlockNum);
                if(!Result)
                {
                    ToLog("2. ****FIND BAD ACCOUNT HASH IN BLOCK: "+BlockNumHash+ " DO BLOCK="+BlockNum);
                    ToLog("Need to Rewrite transactions from: "+(Block.BlockNum-2*DELTA_BLOCK_ACCOUNT_HASH))
                    //SERVER.SetTruncateBlockDB(BlockNum-1);
                    SERVER.SetTruncateBlockDB(BlockNumHash-1);
                    //SERVER.SetRewriteBlockDB();
                }
                else
                {
                    this.NexdDeltaAccountNum=DELTA_BLOCK_ACCOUNT_HASH;
                    SERVER.LastNumAccountHashOK=BlockNumHash;
                }

                break;
            }
        }

        var item=WALLET.ObservTree.find({HASH:shaarr(Body)});
        if(item)
        {
            if(Result===true)
                Result="Add to blockchain";
            item.result=Result;
            ToLogClient(Result,GetHexFromArr(item.HASH),true);
            WALLET.ObservTree.remove(item);
        }

        return Result;
    }


    DoCoinBaseTR(Block)
    {
        if(Block.BlockNum<global.START_MINING)
            return;


        var SysData=this.ReadValue(0);
        var SysBalance=SysData.Value.SumTER;
        const REF_PERIOD_START=global.START_MINING;
        const REF_PERIOD_END=30*1000*1000;
        var AccountID=ReadUintFromArr(Block.AddrHash,0);
        if(AccountID<8)
            return;


        var Data=this.ReadValue(AccountID);
        if(Data && Data.Currency===0 && Data.BlockNumCreate<Block.BlockNum)
        {
            var Power=GetPowPower(Block.Hash);
            var Sum=Power*Power*SysBalance/TOTAL_TER_MONEY/100;


            var CoinTotal={SumTER:0,SumCENT:0};
            var CoinSum=this.COIN_FROM_FLOAT(Sum);
            if(!this.ISZERO(CoinSum))
            {

                if(Data.Adviser>=8 && Block.BlockNum<REF_PERIOD_END)
                {
                    var RefData=this.ReadValue(Data.Adviser);
                    if(RefData && RefData.BlockNumCreate<Block.BlockNum-REF_PERIOD_MINING)
                    {
                        var K=(REF_PERIOD_END-Block.BlockNum)/(REF_PERIOD_END-REF_PERIOD_START);
                        var CoinAdv=this.COIN_FROM_FLOAT(Sum*K);

                        this.SendMoney(0,Data.Adviser,CoinAdv,Block.BlockNum,"Adviser coin base ["+AccountID+"]");
                        this.ADD(CoinTotal,CoinAdv);

                        this.ADD(CoinSum,CoinAdv);
                    }
                }



                this.SendMoney(0,AccountID,CoinSum,Block.BlockNum,"Coin base");
                this.ADD(CoinTotal,CoinSum);

                var CoinDevelop=CopyObjValue(CoinTotal);
                this.DIV(CoinDevelop,100);
                if(!this.ISZERO(CoinDevelop))
                    this.SendMoney(0,9,CoinDevelop,Block.BlockNum,"Developers support");
            }
        }
    }

    GetScriptTransaction(Body)
    {
        var Type=Body[0];

        var format;
        switch (Type)
        {
            case TYPE_TRANSACTION_CREATE:
            {
                format=FORMAT_CREATE;
                break;
            }

            // case TYPE_TRANSACTION_CHANGE:
            // {
            //     Result=this.TRChangeAccount(Body,BlockNum);
            //     break;
            // }

            case TYPE_TRANSACTION_TRANSFER:
            {
                format=FORMAT_MONEY_TRANSFER;
                break;
            }
            case TYPE_TRANSACTION_TRANSFER2:
            {
                format=FORMAT_MONEY_TRANSFER2;
                break;
            }
            case TYPE_TRANSACTION_ACC_HASH:
            {
                format=FORMAT_ACCOUNT_HASH;
                break;
            }

            default:
                return "";
        }
        try
        {
            var TR=BufLib.GetObjectFromBuffer(Body,format,{});
        }
        catch (e)
        {
            return "";
        }

        ConvertBufferToStr(TR);
        return JSON.stringify(TR,"",2);
    }

    TRCheckAccountHash(Body,BlockNum)
    {
        try
        {
            var TR=BufLib.GetObjectFromBuffer(Body,FORMAT_ACCOUNT_HASH,{});
        }
        catch (e)
        {
            return 0;
        }

        // var BlockNumHash=BlockNum-DELTA_BLOCK_ACCOUNT_HASH;
        // if(BlockNumHash<0)
        //     BlockNumHash=0;
        // if(TR.BlockNum!==BlockNumHash)
        //     return 0;

        var Item=this.DBAccountsHash.Read(TR.BlockNum);
        if(Item)
        {
            if(CompareArr(Item.Hash,TR.Hash)===0)
                return 1;
            else
                return 0;
        }
        else
            return 2;
    }

    TRCreateAccount(Body,BlockNum)
    {
        if(Body.length<90)
            return "Error length transaction (retry transaction)";

        var HASH=shaarr(Body);
        var power=GetPowPower(HASH);

        var MinPower;
        if(BlockNum<2500000)
            MinPower=MIN_POWER_POW_ACC_CREATE;
        else
        if(BlockNum<2800000)
            MinPower=MIN_POWER_POW_ACC_CREATE+2;
        else
            MinPower=MIN_POWER_POW_ACC_CREATE+3;

        if(power<MinPower)
            return "Error min power POW for create account (update client)";

        try
        {
            var TR=BufLib.GetObjectFromBuffer(Body,FORMAT_CREATE,{});
        }
        catch (e)
        {
            return "Error transaction format (retry transaction)";
        }

        if(BlockNum>=3500000 && !TR.Description)
            return "Account name required";


        var Data = TR;
        Data.Num=undefined;
        Data.Value={};
        Data.BlockNumCreate=BlockNum;
        if(Data.Adviser>this.GetMaxAccount())
            Data.Adviser=0;
        this.DBState.Write(Data);
        var Act={ID:Data.Num,BlockNum:BlockNum, PrevValue:{},Mode:1};
        this.DBAct.Write(Act);



        if(CompareArr(Data.PubKey,WALLET.PubKeyArr)===0)
        {
            WALLET.OnCreateAccount(Data);
        }

        return true;
    }

    TRChangeAccount(Body,BlockNum)
    {

        if(Body.length<150)
            return "Error length transaction (retry transaction)";

        const FORMAT_CHANGE=
            "{\
            Type:byte,\
            ID:uint,\
            PubKey:arr33,\
            Description:str40,\
            OperationID:uint,\
            Sign:arr64,\
            }";//1+6+33+40+1+6+64=87+64=151


        try
        {
            var TR=BufLib.GetObjectFromBuffer(Body,FORMAT_CHANGE,{});
        }
        catch (e)
        {
            return "Error transaction format (retry transaction)";
        }

        //find account db
        var Data=this.ReadValue(TR.ID);
        if(!Data)
            return;


        //check sign
        var hash=shabuf(Body.slice(0,Body.length-64-12));
        var Result=0;
        if(Data.PubKey[0]===2 || Data.PubKey[0]===3)
        try{Result=secp256k1.verify(hash, TR.Sign, Data.PubKey);}catch (e){};
        if(!Result)
        {
            return "Error sign";
        }


        var Act={ID:Data.Num,BlockNum:BlockNum};
        Data.PrevValue=CopyObjValue(Data.Value);

        Data.Description=TR.Description;
        Data.PubKey=TR.PubKey;
        //Data.Value.AdviserID=TR.AdviserID;

        this.DBState.Write(Data);
        this.DBAct.Write(Act);
    }


    TRTransferMoney(Body,BlockNum,format_money_transfer,workstructtransfer)
    {
        if(Body.length<103)
            return "Error length transaction (retry transaction)";


        try
        {
            var TR=BufLib.GetObjectFromBuffer(Body,format_money_transfer,workstructtransfer);
        }
        catch (e)
        {
            return "Error transaction format (retry transaction)";
        }

        //find account db
        var Data=this.ReadValue(TR.FromID);
        if(!Data)
            return "Error sender account ID";
        if(TR.Currency!==Data.Currency)
            return "Error sender currency";
        if(TR.OperationID!==Data.Value.OperationID)
            return "Error OperationID (expected: "+Data.Value.OperationID+" for ID: "+TR.FromID+"). Create new transaction!";

        //calc sum
        var TotalSum={SumTER:0,SumCENT:0};
        var MapItem={};
        var bWas=0;
        for(var i=0;i<TR.To.length;i++)
        {
            var Item=TR.To[i];
            if(Item.SumTER>MAX_SUM_TER)
                return "Error MAX_SUM_TER";
            if(Item.SumCENT>=MAX_SUM_CENT)
                return "Error MAX_SUM_CENT";

            if(Item.ID===TR.FromID || MapItem[Item.ID])
                continue;
            MapItem[Item.ID]=1;

            bWas=1;
            this.ADD(TotalSum,Item);
        }


        if(!bWas)
            return "No significant recipients";

        //check sum
        if(TotalSum.SumTER===0 && TotalSum.SumCENT===0)
            return "No money transaction";

        if(Data.Value.SumTER<TotalSum.SumTER || (Data.Value.SumTER===TotalSum.SumTER && Data.Value.SumCENT<TotalSum.SumCENT))
            return "Not enough money on the account";


        //ToLog("Transfer = "+TotalSum.SumTER+"   on "+BlockNum);

        //transfer sum
        var arr=[];

        MapItem={};
        var arrpub=[];
        for(var i=0;i<TR.To.length;i++)
        {
            var Item=TR.To[i];

            var DataTo=this.ReadValue(Item.ID);
            if(!DataTo)
                return "Error receiver account ID";
            if(TR.Currency!==DataTo.Currency)
                return "Error receiver currency";

            for(var j=0;j<33;j++)
                arrpub[arrpub.length]=DataTo.PubKey[j];

            if(Item.ID===TR.FromID || MapItem[Item.ID])
                continue;
            MapItem[Item.ID]=1;


            DataTo.PrevValue=CopyObjValue(DataTo.Value);

            DataTo.ActDirect="+";
            DataTo.ActSumTER=Item.SumTER;
            DataTo.ActSumCENT=Item.SumCENT;

            this.ADD(DataTo.Value,Item);
            arr.push(DataTo);
        }
        if(arr.length===0)
            return "No recipients";



        //check sign
        var hash;
        if(TR.Version===2)
        {
            for(var j=0;j<Body.length-64-12;j++)
                arrpub[arrpub.length]=Body[j];
            hash=shabuf(arrpub);
        }
        else
        if(!TR.Version)
        {
            hash=shabuf(Body.slice(0,Body.length-64-12));
        }
        else
        {
            return "Error transaction version";
        }


        var Result=0;
        if(Data.PubKey[0]===2 || Data.PubKey[0]===3)
        try{Result=secp256k1.verify(hash, TR.Sign, Data.PubKey);}catch (e){};
        if(!Result)
        {
            return "Error sign transaction";
        }

        Data.PrevValue=CopyObjValue(Data.Value);
        Data.ActDirect="-";
        Data.ActSumTER=TotalSum.SumTER;
        Data.ActSumCENT=TotalSum.SumCENT;

        this.SUB(Data.Value,TotalSum);
        arr.push(Data);

        Data.Value.OperationID++;

        arr.sort(function (a,b)
        {
            return a.Num-b.Num;
        });

        for(var i=0;i<arr.length;i++)
        {
            this.WriteValue(TR,arr[i],BlockNum);
        }

        return true;
    }

    ADD(Coin,Value2)
    {
        Coin.SumTER+=Value2.SumTER;
        Coin.SumCENT+=Value2.SumCENT;

        if(Coin.SumCENT>=MAX_SUM_CENT)
        {
            Coin.SumCENT-=MAX_SUM_CENT;
            Coin.SumTER++;
        }

        return true;
    }

    SUB(Coin,Value2)
    {
        Coin.SumTER-=Value2.SumTER;
        if(Coin.SumCENT>=Value2.SumCENT)
        {
            Coin.SumCENT-=Value2.SumCENT;
        }
        else
        {
            Coin.SumCENT=MAX_SUM_CENT+Coin.SumCENT-Value2.SumCENT;
            Coin.SumTER--;
        }
        if(Coin.SumTER<0)
        {
            //TO_ERROR_LOG("ACCOUNT",10,"Coin.SumTER<0");
            return false;
        }
        return true;
    }

    DIV(Coin,Value)
    {
        Coin.SumTER=Coin.SumTER/Value;
        Coin.SumCENT=Math.trunc(Coin.SumCENT/Value);

        var SumTER=Math.trunc(Coin.SumTER);
        var SumCENT=Math.trunc((Coin.SumTER-SumTER)*MAX_SUM_CENT);

        Coin.SumTER=SumTER;
        Coin.SumCENT=Coin.SumCENT+SumCENT;

        if(Coin.SumCENT>=MAX_SUM_CENT)
        {
            Coin.SumCENT-=MAX_SUM_CENT;
            Coin.SumTER++;
        }
        return true;
    }

    FLOAT_FROM_COIN(Coin)
    {
        var Sum=Coin.SumTER+Coin.SumCENT/1e9;
        return Sum;
    }
    COIN_FROM_FLOAT(Sum)
    {
        var SumTER=Math.trunc(Sum);
        var SumCENT=Math.trunc((Sum-SumTER)*MAX_SUM_CENT);
        var Coin={SumTER:SumTER,SumCENT:SumCENT};

        //check
        var Sum2=this.FLOAT_FROM_COIN(Coin);
        if(Sum2!==Sum2)
        {
            throw "ERR CHECK COIN_FROM_FLOAT";
        }

        return Coin;
    }

    ISZERO(Coin)
    {
        if(Coin.SumTER===0 && Coin.SumCENT===0)
            return true;
        else
            return false;
    }


    WriteState(Data)
    {
        //ToLog(""+Data.Num+". WRITE SumCENT="+Data.Value.SumCENT)

        this.DBState.Write(Data);
    }

    ReadState(Num)
    {
        var Data=this.DBState.Read(Num);
        if(Data)
            Data.WN="";
        return Data;
    }

    WriteValue(TR,Data,BlockNum)
    {
        //остатки
        Data.Value.BlockNum=BlockNum;
        this.WriteState(Data);

        //движения
        var Act={Num:undefined, ID:Data.Num, BlockNum:BlockNum, Description:TR.Description, PrevValue:Data.PrevValue};
        this.DBAct.Write(Act);


        if(WALLET.AccountMap[Act.ID]!==undefined)
            WALLET.OnDoHistoryAct(TR,Data,BlockNum);

    }

    ReadValue(Num)
    {
        return this.ReadState(Num);
    }

    DeleteAct(BlockNumFrom)
    {
        this.DeleteActOneDB(this.DBAct,BlockNumFrom)
        this.DeleteActOneDB(this.DBActPrev,BlockNumFrom)
        this.DBAccountsHash.Truncate(BlockNumFrom-1);

        WALLET.OnDeleteBlock(BlockNumFrom);
    }

    DeleteActOneDB(DBAct,BlockNum)
    {
        var MaxNum=DBAct.GetMaxNum();
        if(MaxNum===-1)
            return;

        for(var num=MaxNum;num>=0;num--)
        {
            var ItemCheck=DBAct.Read(num);
            if(!ItemCheck)
            {
                ToLogTrace("!ItemCheck");
                throw "ERRR DeleteActOneDB";
            }

            if(ItemCheck.BlockNum<BlockNum)//нашли
            {
                this.ProcessingDeleteAct(DBAct,num+1);
                return;
            }
        }
        //не нашли
        this.ProcessingDeleteAct(DBAct,0);
    }


    ProcessingDeleteAct(DBAct,StartNum)
    {
        //clear data
        var Map={};
        var bWas=0;
        var NumTruncateState;
        for(var num=StartNum;true;num++)
        {
            var Item=DBAct.Read(num);
            if(!Item)
                break;

            bWas=1;

            if(Map[Item.ID])
                continue;
            Map[Item.ID]=1;

            if(Item.Mode===1)
            {
                //was create
                //but delete now

                if(!NumTruncateState)
                    NumTruncateState=Item.ID;
            }
            else
            {
                var Data=this.DBState.Read(Item.ID);
                Data.Value=Item.PrevValue;
                this.WriteState(Data);
            }
        }


        if(bWas)
        {
            if(NumTruncateState)
            {
                //ToLog("********DBState Truncate: "+NumTruncateState)
                this.DBState.Truncate(NumTruncateState-1);
            }
            //ToLog("*********"+DBAct.FileName+" Truncate: "+(StartNum));
            DBAct.Truncate(StartNum-1);
        }
    }


    /////////////////////////////
    FindAccounts(PubKeyArr,map,nSet)
    {
        var Count=0;
        for(var num=0;true;num++)
        {
            var Data=this.ReadState(num);
            if(!Data)
                break;

            if(CompareArr(Data.PubKey,PubKeyArr)===0)
            {
                map[Data.Num]=nSet;
                Count++;
            }
        }
        return Count;
    }

    GetWalletAccountsByMap(map)
    {
        var arr=[];
        for(var key in map)
        {
            var Num=parseInt(key);
            var Data=this.ReadState(Num);
            if(Data)
            {
                if(!Data.PubKeyStr)
                    Data.PubKeyStr=GetHexFromArr(Data.PubKey);
                arr.push(Data);
                Data.WN=map[key];
                Data.Description=this.NormalizeName(Data.Description);
            }
        }
        return arr;
    }

    /////////////////////////////
    /////////////////////////////
    /////////////////////////////

    //API - use: DApps.Accounts.APIMethod1()
    GetMaxAccount()
    {
        return this.DBState.GetMaxNum();
    }

    //Scroll
    GetRowsAccounts(start,count,Filter)
    {


        var WasError=0;
        var arr=[];
        for(var num=start;true;num++)
        {
            var Data=this.ReadState(num);
            if(!Data)
                break;
            if(!Data.PubKeyStr)
                Data.PubKeyStr=GetHexFromArr(Data.PubKey);

            Data.Description=this.NormalizeName(Data.Description);

            if(Filter)
            {
                var Cur="TERA";
                var ID=Data.Num;
                var Operation=Data.Value.OperationID;
                var Amount=this.FLOAT_FROM_COIN(Data.Value);
                var Adviser=Data.Adviser;
                var Name=Data.Description;
                var PubKey=GetHexFromArr(Data.PubKey);
                try
                {
                    if(!eval(Filter))
                        continue;
                }
                catch (e)
                {
                    if(!WasError)
                        ToLog(e);
                    WasError=1;
                }
            }

            arr.push(Data);
            count--;
            if(count<0)
                break;
        }


        return arr;
    }
    NormalizeName(Name)
    {
        var Str="";
        for(var i=0;i<Name.length;i++)
        {
            var code=Name.charCodeAt(i);
            if(code>=32)
                Str+=code_base.charAt(code-32);
        }
        return Str;
    }


    GetActsMaxNum()
    {
        return this.DBActPrev.GetMaxNum()+this.DBAct.GetMaxNum();
    }
    GetActsAll(start,count)
    {

        var arr=[];
        var num;
        for(num=start;num<start+count;num++)
        {
            var Item=this.DBActPrev.Read(num);
            if(!Item)
                break;
            Item.Num="Prev."+Item.Num;
            arr.push(Item);
            if(arr.length>count)
                return arr;
        }
        start=num-this.DBActPrev.GetMaxNum()-1;

        for(num=start;num<start+count;num++)
        {
            var Item=this.DBAct.Read(num);
            if(!Item)
                break;
            Item.Num=Item.Num;
            arr.push(Item);
            if(arr.length>count)
                return arr;
        }
        return arr;
    }

    /////////////////////////////

    GetHashOrUndefined(BlockNum)
    {
        var Item=this.DBAccountsHash.Read(BlockNum);
        if(Item)
            return Item.Hash;
        else
            return undefined;
    }
    CalcHash(BlockNum)
    {
        if(BlockNum>20)
        {
            //check prev value
            var PrevData=this.DBAccountsHash.Read(BlockNum-1);
            if(!PrevData || PrevData.BlockNum!==BlockNum-1)
            {
                ToLogTrace("Error write Account Hash. On BlockNum:"+BlockNum);
                SERVER.SetTruncateBlockDB(BlockNum-20);
                //throw "Error write Account Hash";
            }
        }


        //calc Merkle Tree
        if(this.DBState.WasUpdate)
        {
            this.DBState.MerkleHash=this.DBState.CalcMerkleTree();
            this.DBState.WasUpdate=0;
        }
        var Hash=this.DBState.MerkleHash;

        var Data={Num:BlockNum,BlockNum:BlockNum,Hash:Hash};
        this.DBAccountsHash.Write(Data);
        this.DBAccountsHash.Truncate(BlockNum);
    }

    /////////////////////////////
    GetHashFromKeyDescription(Item)
    {
        var DescArr=shaarr(Item.Description);
        return shaarr2(Item.PubKey,DescArr);
    }

    GetAdviserByMiner(Map,Id)
    {
        var Adviser=Map[Id];
        if(Adviser===undefined)
        {
            var Item=this.ReadState(Id);
            if(Item)
                Adviser=Item.Adviser;
            else
                Adviser=0;
            Map[Id]=Adviser;
        }
        return Adviser;
    }


    /////////////////////////////


    TestTest(BlockNum)
    {
       this.DeleteAct(BlockNum);
    }
}



module.exports = AccountApp;
var App=new AccountApp;
DApps["Accounts"]=App;
DAppByType[TYPE_TRANSACTION_CREATE]=App;
DAppByType[TYPE_TRANSACTION_TRANSFER]=App;
DAppByType[TYPE_TRANSACTION_TRANSFER2]=App;
DAppByType[TYPE_TRANSACTION_ACC_HASH]=App;



