﻿using ProtoBuf;

namespace checker.stargate
{
	[ProtoContract]
	internal class Transmission
	{
		[ProtoMember(1)] public long Timestamp;
		[ProtoMember(2)] public string Name;
		[ProtoMember(3)] public string Entropy;
	}
}