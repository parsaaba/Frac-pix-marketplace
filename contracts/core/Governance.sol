//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

contract Governance is OwnableUpgradeable {
    enum Status {
        InProduction,
        Active,
        Completed,
        Closed
    }
    struct Proposal {
        string title;
        string description;
        bool isModerator;
        bool isVoted;
        uint8 result;
        uint256 createdTime;
        uint256 power1;
        uint256 power2;
        uint256 replies;
        mapping(address => uint256) staked;
        mapping(address => uint256) delegated;
        mapping(address => uint256) delegate;
        Status status;
    }

    event ProposalCreated(uint256 pid);
    event Voted(uint256 pid, bool status);
    event ProposalClosed(uint256 pid);
    event ProposalCompleted(uint256 pid, uint8 result);
    event Withdrawn(uint256 indexed pid, uint256 amount, address account);
    event PowerDelegated(uint256 indexed _pid, address user, uint256 amount);
    event PowerWithdrawn(uint256 indexed _pid, address user, uint256 amount);
    event WithdrawnDelegatedPower(uint256 _pid, address user, uint256 amount);

    uint256 public pid;
    uint256 public period;
    IERC20Upgradeable public pixToken;
    mapping(uint256 => Proposal) public proposal;
    mapping(address => bool) public moderators;

    function initialize(address _pixt, uint256 _period) public initializer {
        require(_pixt != address(0), "GOV: INVALID_PIXT");
        __Ownable_init();
        pixToken = IERC20Upgradeable(_pixt);
        period = _period;
    }

    function setModerator(address moderator, bool approved) external onlyOwner {
        require(moderator != address(0), "GOV: INVALID_MODERATOR");
        moderators[moderator] = approved;
    }

    function createProposal(string calldata _title, string calldata _description) external {
        require(pixToken.balanceOf(msg.sender) >= 1e18, "createProposal: insufficiency balance");
        require(bytes(_title).length > 0, "GOV: INVALID_TITLE");
        require(bytes(_description).length > 0, "GOV: INVALID_DESCRIPTION");
        Proposal storage _proposal = proposal[pid];
        if (moderators[msg.sender]) {
            _proposal.isModerator = true;
        }
        _proposal.title = _title;
        _proposal.description = _description;
        _proposal.createdTime = block.timestamp;

        emit ProposalCreated(pid);
        pid += 1;
    }

    function voting(
        uint256 _pid,
        uint256 _amount,
        bool status
    ) external {
        require(pid > _pid, "GOV: INVALID_PID");
        Proposal storage _proposal = proposal[_pid];
        require(
            pixToken.balanceOf(msg.sender) + _proposal.delegated[msg.sender] >= _amount,
            "GOV: INSUFFOCOENCY_BALANCE"
        );

        require(_proposal.createdTime + period >= block.timestamp, "GOV: PROPOSAL_ENDED");

        if (!_proposal.isVoted) {
            _proposal.replies += 1;
        }

        uint256 amount;
        if (_proposal.delegated[msg.sender] >= _amount) {
            _proposal.delegated[msg.sender] -= _amount;
            amount = _amount;
        } else {
            _proposal.delegated[msg.sender] = 0;
            amount = _amount - _proposal.delegated[msg.sender];
        }
        pixToken.transferFrom(msg.sender, address(this), amount);
        _proposal.staked[msg.sender] += amount;

        if (status) {
            _proposal.power1 += _amount;
        } else {
            _proposal.power2 += _amount;
        }

        _proposal.status = Status.Active;
        _proposal.isVoted = true;

        emit Voted(_pid, status);
    }

    function delegatePower(
        uint256 _pid,
        address _user,
        uint256 _amount
    ) external {
        require(pid > _pid, "GOV: INVALID_PID");
        require(_amount > 0, "GOV: INVALID_AMOUNT");

        Proposal storage _proposal = proposal[_pid];
        pixToken.transferFrom(msg.sender, address(this), _amount);
        _proposal.delegate[msg.sender] += _amount;
        _proposal.delegated[_user] += _amount;

        emit PowerDelegated(_pid, _user, _amount);
    }

    function withdrawDelegatedPower(uint256 _pid) external {
        require(pid > _pid, "GOV: INVALID_PID");

        Proposal storage _proposal = proposal[_pid];
        pixToken.transfer(msg.sender, _proposal.delegate[msg.sender]);
        delete _proposal.delegate[msg.sender];

        emit WithdrawnDelegatedPower(_pid, msg.sender, _proposal.delegate[msg.sender]);
    }

    function closeProposal(uint256 _pid) external onlyOwner {
        require(pid > _pid, "GOV: INVALID_PID");
        Proposal storage _proposal = proposal[_pid];
        _proposal.status = Status.Closed;

        emit ProposalClosed(_pid);
    }

    function completeProposal(uint256 _pid) external onlyOwner {
        require(pid > _pid, "GOV: INVALID_PID");

        Proposal storage _proposal = proposal[_pid];
        require(block.timestamp >= _proposal.createdTime + period, "GOV: PERIOD_NOT_ENDED");

        _proposal.status = Status.Completed;

        if (_proposal.power1 == _proposal.power2) {
            _proposal.result = 1;
        } else if (_proposal.power1 <= _proposal.power2) {
            _proposal.result = 2;
        }

        emit ProposalCompleted(_pid, _proposal.result);
    }

    function withdraw(uint256 _pid) external {
        Proposal storage _proposal = proposal[_pid];
        require(
            _proposal.status == Status.Completed || _proposal.status == Status.Closed,
            "GOV: STILL_ACTIVE"
        );
        pixToken.transfer(msg.sender, _proposal.staked[msg.sender]);
        delete _proposal.staked[msg.sender];

        emit Withdrawn(_pid, _proposal.staked[msg.sender], msg.sender);
    }
}
