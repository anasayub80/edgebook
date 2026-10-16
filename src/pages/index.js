import {pageHead} from './common.js';
import overview from './overview.js';
import trades from './trades.js';
import calendar from './calendar.js';
import analytics from './analytics.js';
import equity from './equity.js';
import playbooks from './playbooks.js';
import journal from './journal.js';
import risk from './risk.js';
import connections from './connections.js';
import settings from './settings.js';
export
function view(s,c)
{
  const renders={
    overview,
    trades,
    calendar,
    analytics,
    equity,
    playbooks,
    journal,
    risk,
    connections,
    settings
  };
  return `<div class="page-enter">${pageHead(s)}${renders[s.page](s,c)}</div>`;
}
export {pages,sidebar,topbar} from './common.js';
export {setupArt} from './playbooks.js';
