// The server's protocol: generated types (npm run gen:protocol), plus names the generator can't give.
import type { EffortRequest, Protocol, Session } from './protocol.gen';

export type * from './protocol.gen';
export type Event = Protocol['event'];
export type Mode = NonNullable<Session['mode']>;
export type Effort = EffortRequest['effort'];
