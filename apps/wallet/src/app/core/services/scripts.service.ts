import { Injectable, ClassProvider, Inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { PublicNode } from './public-node';
import { AuthService } from './auth.service';
import { switchMap, filter, map, shareReplay } from 'rxjs/operators';
import { toPromise } from '../utils';

export const enum TRANSACTION_TYPE {
  TRANSFER = 'transfer',
  LEASE = 'lease',
  CANCEL_LEASING = 'cancelLeasing',
  MASS_TRANSFER = 'massTransfer',
  DATA = 'data',
  SET_SCRIPT = 'setScript',
  ANCHOR = 'anchor'
}

export interface PredefinedScript {
  label: string;
  value: string;
}

const PREDEFINED_SCRIPTS: PredefinedScript[] = [
  {
    label: 'Advisor lock',
    value: `
    let expireTime = 1565992800000
    let transactionType = match tx {
      case t:TransferTransaction => false
      case t:MassTransferTransaction => false
      case t:SetScriptTransaction => false
      case _ => true
    }

    if (expireTime < tx.timestamp) then transactionType
    else true
    `
  },
  {
    label: 'Team lock',
    value: `
    let expireTime = 1579215600000
    let transactionType = match tx {
      case t:TransferTransaction => false
      case t:MassTransferTransaction => false
      case t:SetScriptTransaction => false
      case _ => true
    }

    if (expireTime < tx.timestamp) then transactionType
    else true
    `
  },
  {
    label: 'Delete',
    value: ''
  }
];

const PREDEFINED_SCRIPTS_TEST: PredefinedScript[] = [
  {
    label: 'Advisor lock',
    value: `
    let expireTime = 1565992800000
    let transactionType = match tx {
      case t:TransferTransaction => false
      case t:MassTransferTransaction => false
      case _ => true
    }

    if (expireTime < tx.timestamp) then transactionType
    else true
    `
  },
  {
    label: 'Team lock',
    value: `
    let expireTime = 1579215600000
    let transactionType = match tx {
      case t:TransferTransaction => false
      case t:MassTransferTransaction => false
      case _ => true
    }

    if (expireTime < tx.timestamp) then transactionType
    else true
    `
  },
  {
    label: 'Delete',
    value: ''
  }
];

@Injectable()
export class ScriptsServiceImpl implements ScriptsService {
  predefinedScripts: PredefinedScript[] = PREDEFINED_SCRIPTS_TEST;
  scriptEnabled$: Observable<boolean>;

  constructor(
    private _http: HttpClient,
    private _publicNode: PublicNode,
    private _auth: AuthService
  ) {
    this.scriptEnabled$ = _auth.account$.pipe(
      switchMap(account => {
        if (!account) {
          return of([]);
        }
        return _publicNode.getScript(account.address);
      }),
      map(scriptInfo => {
        return !!scriptInfo.script;
      })
    );
  }

  async createScript(code: string) {
    const wallet: any = await toPromise(this._auth.wallet$);
    return this._publicNode
      .compileScript(code)
      .pipe(
        switchMap(script => {
          return this._auth.ltoInstance.API.PublicNode.transactions.broadcast(
            TRANSACTION_TYPE.SET_SCRIPT,
            {
              script: script.script,
              fee: 1000000
            },
            wallet.getSignKeys()
          );
        })
      )
      .toPromise();
  }
}

export abstract class ScriptsService {
  static provider: ClassProvider = {
    provide: ScriptsService,
    useClass: ScriptsServiceImpl
  };

  abstract predefinedScripts: PredefinedScript[];
  abstract scriptEnabled$: Observable<boolean>;

  abstract createScript(code: string): any;
}