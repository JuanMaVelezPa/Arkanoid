'use strict';

const COLS = 13;
const ROWS = 6;
const ROW_COLORS = [ 'red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green' ];
// X = brick, . = empty. Each string length is 13. Six rows per level.
const LEVELS = [
  [ // 1 full
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX'
  ],
  [ // 2 checker
    'X.X.X.X.X.X.X',
    '.X.X.X.X.X.X.',
    'X.X.X.X.X.X.X',
    '.X.X.X.X.X.X.',
    'X.X.X.X.X.X.X',
    '.X.X.X.X.X.X.'
  ],
  [ // 3 pyramid
    '.....XXX.....',
    '....XXXXX....',
    '...XXXXXXX...',
    '..XXXXXXXXX..',
    '.XXXXXXXXXXX.',
    'XXXXXXXXXXXXX'
  ],
  [ // 4 two banks
    'XXXXX...XXXXX',
    'XXXXX...XXXXX',
    'XXXXX...XXXXX',
    'XXXXX...XXXXX',
    'XXXXX...XXXXX',
    'XXXXX...XXXXX'
  ],
  [ // 5 sparse
    'X.X.X.X.X.X.X',
    '.............',
    '.X.X.X.X.X.X.',
    '.............',
    'X.X.X.X.X.X.X',
    '.............'
  ]
];
