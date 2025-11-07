/**
 * ICP Multisig Canister IDL Definition
 *
 * This file defines the interface for the multisig wallet Canister
 */

import { IDL } from '@dfinity/candid';

/**
 * Parameters for X402 transfer authorization action
 * Used for EIP-712 signature transferWithAuthorization
 */
export interface X402TransferWithAuthorizationAction {
  /** Recipient address */
  to: string;
  /** Valid after time (hex string) */
  valid_after: string;
  /** Valid before time (hex string) */
  valid_before: string;
  /** Transfer amount (hex string) */
  value: string;
  /** EIP-712 domain name */
  domain_name: string;
  /** EIP-712 domain version */
  domain_version: string;
  /** Vault ID */
  vault_id: bigint;
  /** EIP-712 domain chain ID (hex string) */
  domain_chain_id: string;
  /** Nonce (hex string) */
  nonce: string;
  /** Verifying contract address */
  verifying_contract: string;
}

/**
 * Request type Variant
 * Contains all possible request types
 */
export type RequestType = {
  X402TransferWithAuthorization?: {
    action: X402TransferWithAuthorizationAction;
  };
  // Other types can be added when needed
};

/**
 * Parameters for creating a request
 * Used for create_request method
 */
export interface CreateRequestParams {
  /** Request type (variant) */
  request_type: RequestType;
  /** Expiration time (optional, nanoseconds) */
  expire_time: [] | [bigint];
}

/**
 * Request status enumeration
 */
export enum RequestStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
  Executed = 'Executed',
  Expired = 'Expired',
}

/**
 * Approval record
 */
export interface Approval {
  /** Whether approved */
  approved: boolean;
  /** Approver */
  approver: string;
  /** Timestamp */
  timestamp: bigint;
}

/**
 * Request record
 * Returned from the canister's get_request method
 */
export interface RequestRecord {
  /** Request ID */
  id: bigint;
  /** Execution result (signature) - optional, Candid Opt type decoded as [] or [string] */
  execution_result: [] | [string];
  /** Request status */
  status: { [key in RequestStatus]?: null };
  /** Execution time - optional, Candid Opt type decoded as [] or [bigint] */
  executed_at: [] | [bigint];
  /** Request details */
  request: any; // Request type is complex, using any here
  /** Creation time */
  created_at: bigint;
  /** Proposer */
  proposer: string;
  /** Approval list */
  approvals: Approval[];
}

/**
 * IDL Factory Function
 * Defines the Canister interface
 */
export const MultisigIdlFactory: IDL.InterfaceFactory = ({ IDL }) => {
  // ========== Basic Type Definitions ==========

  // CanisterInit type (used for Canister initialization, not used for now)
  // const CanisterInit = IDL.Record({
  //   initial_hash: IDL.Text,
  //   owners: IDL.Vec(IDL.Principal),
  //   name: IDL.Text,
  //   initial_version: IDL.Text,
  // });

  const SignRequest = IDL.Record({
    to: IDL.Text,
    gas: IDL.Nat,
    value: IDL.Nat,
    max_priority_fee_per_gas: IDL.Nat,
    data: IDL.Opt(IDL.Text),
    max_fee_per_gas: IDL.Nat,
    chain_id: IDL.Nat,
    nonce: IDL.Nat,
    tx_hash: IDL.Opt(IDL.Text),
  });

  const SubAcquiringAccountETHTransactionAction = IDL.Record({
    request: SignRequest,
    sub_acquiring_account_id: IDL.Text,
  });

  const ICRCSubAcquiringAccountTransferAction = IDL.Record({
    to: IDL.Record({
      owner: IDL.Principal,
      subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
    }),
    fee: IDL.Opt(IDL.Nat),
    memo: IDL.Opt(IDL.Vec(IDL.Nat8)),
    sub_acquiring_account_id: IDL.Text,
    ledger_canister_id: IDL.Principal,
    created_at_time: IDL.Opt(IDL.Nat64),
    amount: IDL.Nat,
  });

  const UpdateCheckResponse = IDL.Record({
    update_available: IDL.Bool,
    latest_hash: IDL.Vec(IDL.Nat8),
    current_hash: IDL.Vec(IDL.Nat8),
    current_version: IDL.Text,
    latest_version: IDL.Text,
  });

  const AcquiringAccountETHTransactionAction = IDL.Record({
    request: SignRequest,
    acquiring_account_id: IDL.Nat64,
  });

  const ETHTransactionAction = IDL.Record({
    request: SignRequest,
    vault_id: IDL.Nat64,
  });

  // ========== X402 Transfer Authorization Action ==========
  const X402TransferWithAuthorizationAction = IDL.Record({
    to: IDL.Text,
    valid_after: IDL.Text,
    valid_before: IDL.Text,
    value: IDL.Text,
    domain_name: IDL.Text,
    domain_version: IDL.Text,
    vault_id: IDL.Nat64,
    domain_chain_id: IDL.Text,
    nonce: IDL.Text,
    verifying_contract: IDL.Text,
  });

  const ThresholdMode = IDL.Variant({
    Weighted: IDL.Record({ threshold: IDL.Nat32 }),
    Simple: IDL.Record({ threshold: IDL.Nat32 }),
  });

  const WeightedApprover = IDL.Record({
    weight: IDL.Nat8,
    principal_id: IDL.Principal,
  });

  const ThresholdConfig = IDL.Record({
    mode: ThresholdMode,
    approvers: IDL.Vec(WeightedApprover),
  });

  const TransferRule = IDL.Record({
    threshold_config: ThresholdConfig,
    amount: IDL.Nat,
  });

  const BetweenTransferRule = IDL.Record({
    min_amount: IDL.Nat,
    threshold_config: ThresholdConfig,
    max_amount: IDL.Nat,
  });

  const TransferAdvancedRule = IDL.Record({
    less_than: IDL.Opt(IDL.Vec(TransferRule)),
    between: IDL.Opt(IDL.Vec(BetweenTransferRule)),
    greater_than: IDL.Opt(IDL.Vec(TransferRule)),
  });

  const CreateVaultAction = IDL.Record({
    vault_name: IDL.Text,
    organization_id: IDL.Nat64,
    threshold_config: ThresholdConfig,
    advance_rule: IDL.Opt(TransferAdvancedRule),
    viewer: IDL.Opt(IDL.Vec(IDL.Principal)),
  });

  const CreateOrganizationAction = IDL.Record({
    organization_viewer: IDL.Opt(IDL.Vec(IDL.Principal)),
    admin_threshold_config: ThresholdConfig,
    organization_name: IDL.Text,
    organization_op: IDL.Opt(IDL.Vec(IDL.Principal)),
  });

  const ETHSignAction = IDL.Record({
    vault_id: IDL.Nat64,
    message: IDL.Text,
  });

  const SolanaSolTxAction = IDL.Record({
    to: IDL.Text,
    blockhash: IDL.Text,
    vault_id: IDL.Nat64,
    tx_hash: IDL.Opt(IDL.Text),
    amount: IDL.Nat,
  });

  const SolanaSplTxAction = IDL.Record({
    to: IDL.Text,
    blockhash: IDL.Text,
    vault_id: IDL.Nat64,
    to_ata: IDL.Text,
    token_program: IDL.Text,
    from_ata: IDL.Text,
    tx_hash: IDL.Opt(IDL.Text),
    amount: IDL.Nat,
    mint_account: IDL.Text,
    need_to_create_ata: IDL.Bool,
  });

  const CreateAcquiringAccountAction = IDL.Record({
    acquiring_account_name: IDL.Text,
    organization_id: IDL.Nat64,
    threshold_config: ThresholdConfig,
    viewer: IDL.Opt(IDL.Vec(IDL.Principal)),
  });

  const ModifyAdminAction = IDL.Variant({
    UpdateThreshold: IDL.Record({ new_threshold: IDL.Nat32 }),
    UpdateAdmin: IDL.Record({ new_threshold_config: ThresholdConfig }),
  });

  const ModifyAcquiringAccountAction = IDL.Record({
    acquiring_account_name: IDL.Opt(IDL.Text),
    threshold_config: IDL.Opt(ThresholdConfig),
    acquiring_account_id: IDL.Nat64,
    viewer: IDL.Opt(IDL.Vec(IDL.Principal)),
  });

  const ICPTransferAction = IDL.Record({
    to: IDL.Text,
    memo: IDL.Opt(IDL.Nat64),
    vault_id: IDL.Nat64,
    created_at_time: IDL.Opt(IDL.Nat64),
    amount: IDL.Nat64,
  });

  const ModifyVaultAction = IDL.Record({
    vault_id: IDL.Nat64,
    vault_name: IDL.Opt(IDL.Text),
    threshold_config: IDL.Opt(ThresholdConfig),
    advance_rule: IDL.Opt(TransferAdvancedRule),
    viewer: IDL.Opt(IDL.Vec(IDL.Principal)),
  });

  const SolanaSignAction = IDL.Record({
    vault_id: IDL.Nat64,
    message: IDL.Text,
  });

  const ICRCAcquiringAccountTransferAction = IDL.Record({
    to: IDL.Record({
      owner: IDL.Principal,
      subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
    }),
    fee: IDL.Opt(IDL.Nat),
    memo: IDL.Opt(IDL.Vec(IDL.Nat8)),
    ledger_canister_id: IDL.Principal,
    created_at_time: IDL.Opt(IDL.Nat64),
    amount: IDL.Nat,
    acquiring_account_id: IDL.Nat64,
  });

  const UpdateOrganizationAction = IDL.Record({
    update_operator: IDL.Opt(IDL.Vec(IDL.Principal)),
    update_viewer: IDL.Opt(IDL.Vec(IDL.Principal)),
    organization_name: IDL.Opt(IDL.Text),
    organization_id: IDL.Nat64,
    update_admin: IDL.Opt(ThresholdConfig),
  });

  const TransferRuleType = IDL.Variant({
    Between: IDL.Null,
    GreaterThan: IDL.Null,
    LessThan: IDL.Null,
  });

  const SelectedTransferRule = IDL.Record({
    rule_type: TransferRuleType,
    rule_index: IDL.Nat64,
  });

  const ICRCTransferAction = IDL.Record({
    to: IDL.Record({
      owner: IDL.Principal,
      subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
    }),
    fee: IDL.Opt(IDL.Nat),
    memo: IDL.Opt(IDL.Vec(IDL.Nat8)),
    selected_rule: IDL.Opt(SelectedTransferRule),
    vault_id: IDL.Nat64,
    ledger_canister_id: IDL.Principal,
    created_at_time: IDL.Opt(IDL.Nat64),
    amount: IDL.Nat,
  });

  const RequestType = IDL.Variant({
    ETHTransactionAcquiringAccount: IDL.Record({
      action: AcquiringAccountETHTransactionAction,
    }),
    ETHTransaction: IDL.Record({ action: ETHTransactionAction }),
    X402TransferWithAuthorization: IDL.Record({
      action: X402TransferWithAuthorizationAction,
    }),
    CreateVault: IDL.Record({ action: CreateVaultAction }),
    CreateOrganization: IDL.Record({ action: CreateOrganizationAction }),
    ETHSign: IDL.Record({ action: ETHSignAction }),
    SolanaSolTx: IDL.Record({ action: SolanaSolTxAction }),
    SolanaSplTx: IDL.Record({ action: SolanaSplTxAction }),
    CreateAcquiringAccount: IDL.Record({
      action: CreateAcquiringAccountAction,
    }),
    ModifyAdmin: IDL.Record({ action: ModifyAdminAction }),
    ModifyAcquiringAccount: IDL.Record({
      action: ModifyAcquiringAccountAction,
    }),
    ICPTransfer: IDL.Record({ action: ICPTransferAction }),
    ModifyVault: IDL.Record({ action: ModifyVaultAction }),
    SolanaSign: IDL.Record({ action: SolanaSignAction }),
    ICRCTransferAcquiringAccount: IDL.Record({
      action: ICRCAcquiringAccountTransferAction,
    }),
    UpdateOrganization: IDL.Record({ action: UpdateOrganizationAction }),
    ICRCTransfer: IDL.Record({ action: ICRCTransferAction }),
  });

  const Request = IDL.Record({
    request_type: RequestType,
    expire_time: IDL.Opt(IDL.Nat64),
  });

  const SubAcquiringAccount = IDL.Record({
    subaccount: IDL.Vec(IDL.Nat8),
    sub_acquiring_account_id: IDL.Text,
    created_at: IDL.Nat64,
    eth_address: IDL.Text,
    solana_address: IDL.Text,
    subaccount_id: IDL.Nat64,
    organization_id: IDL.Nat64,
    updated_time: IDL.Nat64,
    acquiring_account_id: IDL.Nat64,
  });

  const JwkProvider = IDL.Variant({
    Github: IDL.Null,
    Google: IDL.Null,
    Apple: IDL.Null,
  });

  const AcquiringAccount = IDL.Record({
    subaccount: IDL.Vec(IDL.Nat8),
    acquiring_account_name: IDL.Text,
    created_at: IDL.Nat64,
    eth_address: IDL.Text,
    solana_address: IDL.Text,
    organization_id: IDL.Nat64,
    updated_time: IDL.Nat64,
    threshold_config: ThresholdConfig,
    acquiring_account_id: IDL.Nat64,
    viewer: IDL.Opt(IDL.Vec(IDL.Principal)),
  });

  const Organization = IDL.Record({
    organization_viewer: IDL.Vec(IDL.Principal),
    admin_threshold_config: ThresholdConfig,
    update_time: IDL.Nat64,
    organization_name: IDL.Text,
    create_time: IDL.Nat64,
    organization_id: IDL.Nat64,
    organization_op: IDL.Vec(IDL.Principal),
  });

  const RequestStatus = IDL.Variant({
    Approved: IDL.Null,
    Rejected: IDL.Null,
    Executed: IDL.Null,
    Expired: IDL.Null,
    Pending: IDL.Null,
  });

  const Approval = IDL.Record({
    approved: IDL.Bool,
    approver: IDL.Principal,
    timestamp: IDL.Nat64,
  });

  const RequestRecord = IDL.Record({
    id: IDL.Nat64,
    execution_result: IDL.Opt(IDL.Text),
    status: RequestStatus,
    executed_at: IDL.Opt(IDL.Nat64),
    request: Request,
    created_at: IDL.Nat64,
    proposer: IDL.Principal,
    approvals: IDL.Vec(Approval),
  });

  const OrganizationRole = IDL.Variant({
    Op: IDL.Null,
    Viewer: IDL.Null,
    Admin: IDL.Null,
  });

  const UserStatus = IDL.Record({
    user_name: IDL.Text,
    organization_id: IDL.Nat64,
    viewer_in_vault: IDL.Bool,
    roles: IDL.Opt(IDL.Vec(OrganizationRole)),
  });

  const UserStatusList = IDL.Vec(UserStatus);

  const Vault = IDL.Record({
    subaccount: IDL.Vec(IDL.Nat8),
    vault_id: IDL.Nat64,
    created_at: IDL.Nat64,
    eth_address: IDL.Text,
    vault_name: IDL.Text,
    solana_address: IDL.Text,
    organization_id: IDL.Nat64,
    updated_time: IDL.Nat64,
    threshold_config: ThresholdConfig,
    advance_rule: IDL.Opt(TransferAdvancedRule),
    viewer: IDL.Opt(IDL.Vec(IDL.Principal)),
  });

  const Admin = IDL.Record({
    init_time: IDL.Nat64,
    updated_time: IDL.Nat64,
    threshold_config: ThresholdConfig,
  });

  const CyclesReportState = IDL.Record({
    report_interval: IDL.Nat64,
    last_report_time: IDL.Nat64,
    warning_threshold: IDL.Nat,
    last_report_balance: IDL.Nat,
  });

  const Jwks = IDL.Record({ keys: IDL.Vec(IDL.Text) });

  const Permission = IDL.Variant({
    Pro: IDL.Null,
    Free: IDL.Null,
    Business: IDL.Null,
  });

  const SystemAccessControl = IDL.Record({
    permission: Permission,
    limit: IDL.Opt(IDL.Nat64),
  });

  const UpgradeStatus = IDL.Variant({
    Failed: IDL.Text,
    Idle: IDL.Null,
    Downloading: IDL.Record({ total: IDL.Nat64, progress: IDL.Nat64 }),
    Upgrading: IDL.Null,
    Success: IDL.Text,
    Verifying: IDL.Null,
  });

  const AcquiringAccountIdList = IDL.Record({
    acquiring_account_ids: IDL.Vec(IDL.Nat64),
    wallet_viewer: IDL.Opt(IDL.Vec(IDL.Nat64)),
  });

  const VaultIdList = IDL.Record({
    vault_ids: IDL.Vec(IDL.Nat64),
    wallet_viewer: IDL.Opt(IDL.Vec(IDL.Nat64)),
  });

  const User = IDL.Record({
    user_principal: IDL.Principal,
    user_name: IDL.Text,
    update_time: IDL.Nat64,
    passkey_name: IDL.Opt(IDL.Vec(IDL.Text)),
    display_name: IDL.Opt(IDL.Text),
    create_time: IDL.Nat64,
  });

  const WalletConfig = IDL.Record({
    owners: IDL.Vec(IDL.Principal),
    name: IDL.Text,
    created_at: IDL.Nat64,
    root_canister: IDL.Opt(IDL.Principal),
    current_hash: IDL.Vec(IDL.Nat8),
    current_version: IDL.Text,
  });

  const Claims = IDL.Record({
    aud: IDL.Text,
    azp: IDL.Opt(IDL.Text),
    exp: IDL.Nat64,
    iat: IDL.Nat64,
    iss: IDL.Text,
    jti: IDL.Opt(IDL.Text),
    nbf: IDL.Nat64,
    sub: IDL.Text,
    name: IDL.Opt(IDL.Text),
    family_name: IDL.Opt(IDL.Text),
    email: IDL.Opt(IDL.Text),
    picture: IDL.Opt(IDL.Text),
    given_name: IDL.Opt(IDL.Text),
    email_verified: IDL.Opt(IDL.Bool),
  });

  const JwtVerificationResult = IDL.Record({
    claims: IDL.Opt(Claims),
    is_valid: IDL.Bool,
    error: IDL.Opt(IDL.Text),
  });

  // ========== Service Interface Definition ==========
  return IDL.Service({
    add_whitelist: IDL.Func([IDL.Principal], [IDL.Bool], []),
    aggregate_sub_acquiring_account_eth_assets: IDL.Func(
      [SubAcquiringAccountETHTransactionAction],
      [IDL.Variant({ Ok: IDL.Text, Err: IDL.Text })],
      []
    ),
    aggregate_sub_acquiring_account_icp_assets: IDL.Func(
      [ICRCSubAcquiringAccountTransferAction],
      [IDL.Variant({ Ok: IDL.Bool, Err: IDL.Text })],
      []
    ),
    check_for_update: IDL.Func(
      [IDL.Principal],
      [IDL.Variant({ Ok: UpdateCheckResponse, Err: IDL.Text })],
      []
    ),
    check_whitelist: IDL.Func([IDL.Principal], [IDL.Bool], ['query']),
    convert_eth_address: IDL.Func([IDL.Nat64], [IDL.Text], []),
    create_request: IDL.Func([Request], [IDL.Nat64], []),
    create_sub_acquiring_account: IDL.Func(
      [IDL.Nat64, IDL.Text],
      [SubAcquiringAccount],
      []
    ),
    execute_request: IDL.Func([IDL.Nat64], [IDL.Bool], []),
    fetch_jwks_via_httpcall: IDL.Func(
      [JwkProvider, IDL.Text],
      [IDL.Variant({ Ok: IDL.Bool, Err: IDL.Text })],
      []
    ),
    finish_passkey_approval: IDL.Func(
      [IDL.Text, IDL.Opt(IDL.Text)],
      [
        IDL.Variant({
          Ok: IDL.Tuple(IDL.Nat64, IDL.Bool),
          Err: IDL.Text,
        }),
      ],
      []
    ),
    get_acquiring_account: IDL.Func(
      [IDL.Nat64],
      [IDL.Opt(AcquiringAccount)],
      ['query']
    ),
    get_all_acquiring_accounts: IDL.Func(
      [],
      [IDL.Vec(AcquiringAccount)],
      ['query']
    ),
    get_all_acquiring_accounts_in_organization: IDL.Func(
      [IDL.Nat64],
      [IDL.Vec(AcquiringAccount)],
      ['query']
    ),
    get_all_organizations: IDL.Func([], [IDL.Vec(Organization)], ['query']),
    get_all_requests: IDL.Func([], [IDL.Vec(RequestRecord)], ['query']),
    get_all_users: IDL.Func([], [IDL.Vec(UserStatusList)], ['query']),
    get_all_vaults: IDL.Func([], [IDL.Vec(Vault)], ['query']),
    get_all_vaults_in_organization: IDL.Func(
      [IDL.Nat64],
      [IDL.Vec(Vault)],
      ['query']
    ),
    get_all_whitelisted: IDL.Func([], [IDL.Vec(IDL.Principal)], ['query']),
    get_allow_credentials_name: IDL.Func(
      [IDL.Text],
      [IDL.Opt(IDL.Text)],
      []
    ),
    get_aud_client: IDL.Func([JwkProvider], [IDL.Opt(IDL.Text)], ['query']),
    get_balance: IDL.Func([], [IDL.Nat], ['query']),
    get_caller: IDL.Func([], [IDL.Principal], ['query']),
    get_current_admin: IDL.Func([], [IDL.Opt(Admin)], ['query']),
    get_cycles_report_state: IDL.Func([], [CyclesReportState], ['query']),
    get_jwks: IDL.Func([JwkProvider], [IDL.Opt(Jwks)], ['query']),
    get_organization: IDL.Func(
      [IDL.Nat64],
      [IDL.Opt(Organization)],
      ['query']
    ),
    get_organization_requests: IDL.Func(
      [IDL.Nat64, IDL.Opt(IDL.Nat64), IDL.Opt(IDL.Nat64)],
      [IDL.Vec(RequestRecord)],
      ['query']
    ),
    get_organization_requests_num: IDL.Func(
      [IDL.Nat64],
      [IDL.Nat64],
      ['query']
    ),
    get_organization_requests_pending: IDL.Func(
      [IDL.Nat64],
      [IDL.Nat64],
      ['query']
    ),
    get_owners: IDL.Func([], [IDL.Vec(IDL.Principal)], ['query']),
    get_request: IDL.Func([IDL.Nat64], [IDL.Opt(RequestRecord)], ['query']),
    get_root_canister_id: IDL.Func([], [IDL.Text], ['query']),
    get_root_principal_to_username: IDL.Func([IDL.Text], [IDL.Text], []),
    get_sub_acquiring_account: IDL.Func(
      [IDL.Nat64, IDL.Text],
      [
        IDL.Variant({
          Ok: IDL.Opt(SubAcquiringAccount),
          Err: IDL.Text,
        }),
      ],
      ['query']
    ),
    get_sub_acquiring_account_by_id: IDL.Func(
      [IDL.Text],
      [IDL.Opt(SubAcquiringAccount)],
      ['query']
    ),
    get_sub_acquiring_accounts: IDL.Func(
      [IDL.Nat64, IDL.Vec(IDL.Text)],
      [
        IDL.Variant({
          Ok: IDL.Vec(SubAcquiringAccount),
          Err: IDL.Text,
        }),
      ],
      ['query']
    ),
    get_system_access_control: IDL.Func(
      [],
      [SystemAccessControl],
      ['query']
    ),
    get_test2_memory: IDL.Func([], [IDL.Nat64], ['query']),
    get_test_memory: IDL.Func([], [IDL.Nat64], ['query']),
    get_upgrade_status: IDL.Func([], [UpgradeStatus], ['query']),
    get_user_acquiring_accounts_in_organization: IDL.Func(
      [IDL.Text, IDL.Nat64],
      [IDL.Opt(AcquiringAccountIdList)],
      ['query']
    ),
    get_user_principal: IDL.Func([IDL.Text], [IDL.Text], ['query']),
    get_user_roles_in_organization: IDL.Func(
      [IDL.Text, IDL.Nat64],
      [IDL.Opt(IDL.Vec(OrganizationRole))],
      ['query']
    ),
    get_user_vaults_in_organization: IDL.Func(
      [IDL.Text, IDL.Nat64],
      [IDL.Opt(VaultIdList)],
      ['query']
    ),
    get_user_via_principal: IDL.Func([IDL.Text], [IDL.Opt(User)], []),
    get_username_by_credential: IDL.Func(
      [IDL.Text],
      [IDL.Opt(IDL.Text)],
      []
    ),
    get_userstatus_via_principal: IDL.Func(
      [IDL.Text],
      [IDL.Opt(UserStatusList)],
      []
    ),
    get_userstatus_via_username: IDL.Func(
      [IDL.Text],
      [IDL.Opt(UserStatusList)],
      ['query']
    ),
    get_vault: IDL.Func([IDL.Nat64], [IDL.Opt(Vault)], ['query']),
    get_wallet_info: IDL.Func([], [WalletConfig], ['query']),
    get_wallet_status: IDL.Func([], [IDL.Text], ['query']),
    greet: IDL.Func([], [IDL.Text], ['query']),
    has_role_in_organization: IDL.Func(
      [IDL.Text, IDL.Nat64, OrganizationRole],
      [IDL.Bool],
      ['query']
    ),
    is_owner: IDL.Func([IDL.Principal], [IDL.Bool], ['query']),
    is_username_registered: IDL.Func([IDL.Text], [IDL.Opt(IDL.Bool)], []),
    principal_to_username: IDL.Func([IDL.Text], [IDL.Text], []),
    remove_whitelist: IDL.Func([IDL.Principal], [IDL.Bool], []),
    reset_upgrade_status: IDL.Func(
      [],
      [IDL.Variant({ Ok: IDL.Text, Err: IDL.Text })],
      []
    ),
    self_upgrade: IDL.Func(
      [],
      [IDL.Variant({ Ok: IDL.Text, Err: IDL.Text })],
      []
    ),
    set_cycles_warning_threshold: IDL.Func(
      [IDL.Nat],
      [IDL.Variant({ Ok: IDL.Text, Err: IDL.Text })],
      []
    ),
    set_eth_transaction_hash: IDL.Func(
      [IDL.Nat64, IDL.Text],
      [IDL.Variant({ Ok: IDL.Bool, Err: IDL.Text })],
      []
    ),
    set_solana_transaction_hash: IDL.Func(
      [IDL.Nat64, IDL.Text],
      [IDL.Variant({ Ok: IDL.Bool, Err: IDL.Text })],
      []
    ),
    set_system_access_control: IDL.Func(
      [SystemAccessControl],
      [IDL.Bool],
      []
    ),
    siwp_prepare_login_username: IDL.Func([IDL.Text], [IDL.Text], []),
    start_passkey_approval: IDL.Func(
      [IDL.Nat64, IDL.Bool],
      [IDL.Variant({ Ok: IDL.Text, Err: IDL.Text })],
      []
    ),
    submit_request_approval: IDL.Func(
      [IDL.Nat64, IDL.Bool, IDL.Opt(IDL.Text)],
      [IDL.Bool],
      []
    ),
    test_user_profile_insert_canister: IDL.Func(
      [IDL.Principal],
      [IDL.Bool],
      []
    ),
    // ========== X402 Core Methods ==========
    /**
     * test_x402: Sign X402 transfer authorization
     * This is the core method used to sign EIP-712 transferWithAuthorization messages
     * Returns signature as hexadecimal string (without 0x prefix)
     */
    test_x402: IDL.Func(
      [X402TransferWithAuthorizationAction],
      [IDL.Variant({ Ok: IDL.Text, Err: IDL.Text })],
      []
    ),
    update_aud_client: IDL.Func(
      [JwkProvider, IDL.Text],
      [IDL.Variant({ Ok: IDL.Bool, Err: IDL.Text })],
      []
    ),
    update_jwks: IDL.Func(
      [JwkProvider, IDL.Text],
      [IDL.Variant({ Ok: IDL.Bool, Err: IDL.Text })],
      []
    ),
    update_test2_memory: IDL.Func([], [], []),
    update_test_memory: IDL.Func([], [], []),
    update_user_status: IDL.Func(
      [IDL.Principal, IDL.Text, IDL.Nat64, IDL.Vec(OrganizationRole)],
      [IDL.Variant({ Ok: UserStatusList, Err: IDL.Text })],
      []
    ),
    validate_version_info: IDL.Func(
      [],
      [IDL.Variant({ Ok: IDL.Text, Err: IDL.Text })],
      ['query']
    ),
    verify_jwt: IDL.Func(
      [IDL.Text, JwkProvider],
      [JwtVerificationResult],
      ['query']
    ),
  });
};
