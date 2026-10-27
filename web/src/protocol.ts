// The server's protocol: generated types (npm run gen:protocol), plus names the generator can't give.
import type { Protocol } from './protocol.gen';

export type * from './protocol.gen';
export type Event = Protocol['event'];
