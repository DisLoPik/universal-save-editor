# Character Data
Offset: 0x2BCAD

63 C9 8F 38 00 15 00 01 5F 02 5F 02 01 01 00 01 01 01 01 01 11 02 00 00 00 00 00 00 01 01

Use of each byte:

* 0x00 - Uint8, represents level. 00 is level 1, 63 is level 100
* 0x01 - Uint8, represents a fraction of 10% of a level's progress. so a uint8 value of 255 represents 10%
* 0x02 - Uint8, represents the value times 10% of a level's progress. Uint8 of 2 means 20% progression towards the next level
* 0x03 - Unsure
* 0x10 - Head (or single) Armor ID
* 0x11 - Upper Armor ID
* 0x12 - Lowr Armor ID