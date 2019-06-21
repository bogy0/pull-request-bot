const request = require('request-promise');
const github = require('octonode');
const timeHelper = require('./humanizedTimeSince');
require('dotenv').config();

const TYPE_OF_SLACK_MESSAGE = [
  {
    color: '#34bc6e',
    identifier: 'APPROVED',
    slackTitle: "These PRs are already Approved, let's merge them!",
    emoji: ':github-approved:'
  },
  {
    color: '#fed500',
    identifier: 'MORE_WORK_NEEDED',
    slackTitle: 'These PRs needs some extra modification',
    emoji: ':working:'
  },
  {
    color: '#e62325',
    identifier: 'REVIEW_REQUESTED',
    slackTitle: "No one reviewed these tickets, let's make them happy!",
    emoji: ':foreveralone:'
  },
  {
    color: '#047cc0',
    identifier: 'WIP',
    slackTitle: 'Watch out! Work In Progress here!',
    emoji: ':warning:'
  },
];

const REVIEW_STATES = Object.freeze({
  APPROVED: 'APPROVED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  COMMENTED: 'COMMENTED',
  DISMISSED: 'DISMISSED',
  MORE_WORK_NEEDED: 'MORE_WORK_NEEDED',
  REVIEW_REQUESTED: 'REVIEW_REQUESTED',
  WIP: 'WIP',
});

// TODO: needs to re-think this const block, eg.: handle multiple repos...
const SLACK_HOOK = process.env.SLACK_HOOK;
const GITHUB_ACCESS_TOKKEN = process.env.GITHUB_ACCESS_TOKKEN;
const GITHUB_ORGANIZATION = process.env.GITHUB_ORGANIZATION ? process.env.GITHUB_ORGANIZATION : 'watsonmedia';
const GITHUB_REPO = process.env.GITHUB_REPO || 'enrichment-api';

const getStateOfPullRequestItem = async function(prItem, labels) {
  const prItemInfo = await prItem.reviewsAsync();
  const actualPRState = {
    APPROVED: 0,
    CHANGES_REQUESTED: 0,
    COMMENTED: 0,
    DISMISSED: 0,
    WIP: 0,
  };

  labels.map(label => {
    if (label.name.includes('WIP')) {
      actualPRState.WIP += 1;
    }
  });

  if (prItemInfo[0].length > 0) {
    prItemInfo[0].map(reviewItem => {
      switch (reviewItem.state) {
        case REVIEW_STATES.APPROVED:
          actualPRState.APPROVED += 1;
          break;
        case REVIEW_STATES.CHANGES_REQUESTED:
          actualPRState.CHANGES_REQUESTED += 1;
          break;
        case REVIEW_STATES.COMMENTED:
          actualPRState.COMMENTED += 1;
          break;
        case REVIEW_STATES.DISMISSED:
          actualPRState.DISMISSED += 1;
          break;
      }
    });

    // Final PR state logic specified in this Feature Request:
    // https://github.ibm.com/Balint-Lendvai/github-notification-slack-bot/issues/9

    if (actualPRState.APPROVED > 2) {
      return REVIEW_STATES.APPROVED;
    }
    if (actualPRState.CHANGES_REQUESTED > 0 || actualPRState.DISMISSED > 0) {
      return REVIEW_STATES.MORE_WORK_NEEDED;
    }
  } else if (actualPRState.WIP > 0) {
    return REVIEW_STATES.WIP;
  }

  return REVIEW_STATES.REVIEW_REQUESTED;
};

const getPullRequests = async function() {
  const client = github.client(GITHUB_ACCESS_TOKKEN, {
    hostname: 'github.ibm.com/api/v3'
  });

  // TODO: handle multiple repos
  const repo = client.repo(`${GITHUB_ORGANIZATION}/${GITHUB_REPO}`);

  const result = await repo.prsAsync({ per_page: 100 });
  const prInfos = await Promise.all(result[0].map(async (pr) => {
    const {
      html_url,
      title,
      number,
      updated_at,
    } = pr;

    const actualPR = {
      reviews: client.pr(`${GITHUB_ORGANIZATION}/${GITHUB_REPO}`, pr.number),
      labels: pr.labels,
    };

    const state = await getStateOfPullRequestItem(actualPR.reviews, actualPR.labels);

    return {
      html_url,
      title,
      number,
      updated_at,
      state,
    }
  }));

  return prInfos;
}

const createSlackMessageBody = function(pullRequests) {
  const attachments = TYPE_OF_SLACK_MESSAGE.map(type => ({
    fallback: `${type.emoji} ${type.slackTitle}`,
    pretext: `${type.emoji} ${type.slackTitle}`,
    color: type.color,
    fields: pullRequests.filter(pr => pr.state === type.identifier).map(pr => ({
      title: `${pr.title}`,
      value: `This PR has not been updated for *${timeHelper.timeSince(pr.updated_at)}*: <${pr.html_url}|#${pr.number}>\n\n`,
      short: false
    }))
  }));

  if (pullRequests.length > 0) {
    return {
      mkdown: true,
      text: `Let's review these Pull Requests from the *${GITHUB_ORGANIZATION}/${GITHUB_REPO}* repo!`,
      attachments: attachments.filter(attachment => attachment.fields.length > 0)
    }
  }

  return {
    mkdown: true,
    text: `:thumbsup: Well done, no open Pull Requests in the repo!`,
  }
};

(async function () {
  console.log(process.env.TEST);
  try {
    const pullRequests = await getPullRequests();

    console.log(pullRequests);

    // post to slack
    const res = await request({
      url: `https://hooks.slack.com/services/${SLACK_HOOK}`,
      method: 'POST',
      body: createSlackMessageBody(pullRequests),
      json: true,
    });

  } catch(e) {
    console.log('Error: ', e);
  }
})();