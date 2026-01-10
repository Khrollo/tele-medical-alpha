"use client";

import * as React from "react";
import { Video, VideoOff, Mic, MicOff, PhoneOff, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/app/_lib/utils/cn";

interface JoinCallContentProps {
  visitId: string;
  roomName: string;
  joinToken: string;
}

export function JoinCallContent({
  visitId,
  roomName,
  joinToken,
}: JoinCallContentProps) {
  const [isPreJoin, setIsPreJoin] = React.useState(true);
  const [isConnected, setIsConnected] = React.useState(false);
  const [isMuted, setIsMuted] = React.useState(false);
  const [isVideoOff, setIsVideoOff] = React.useState(false);
  const [consentGiven, setConsentGiven] = React.useState(false);
  const [room, setRoom] = React.useState<any>(null);
  const [localTrack, setLocalTrack] = React.useState<any>(null);
  const [remoteTracks, setRemoteTracks] = React.useState<any[]>([]);
  const [token, setToken] = React.useState<string | null>(null);
  const localVideoRef = React.useRef<HTMLVideoElement>(null);
  const remoteVideoRef = React.useRef<HTMLVideoElement>(null);

  // Get Twilio token
  React.useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch("/api/video/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointmentId: visitId,
            role: "patient",
            joinToken,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get video token");
        }

        const data = await response.json();
        setToken(data.token);
      } catch (error) {
        console.error("Error fetching token:", error);
        toast.error("Failed to initialize video call");
      }
    };

    fetchToken();
  }, [visitId, joinToken]);

  // Setup pre-join preview
  React.useEffect(() => {
    if (!isPreJoin || !localVideoRef.current) return;

    const setupPreview = async () => {
      try {
        const { createLocalVideoTrack, createLocalAudioTrack } = await import("twilio-video");
        const videoTrack = await createLocalVideoTrack();
        const audioTrack = await createLocalAudioTrack();
        
        setLocalTrack({ video: videoTrack, audio: audioTrack });
        videoTrack.attach(localVideoRef.current!);
      } catch (error) {
        console.error("Error setting up preview:", error);
        toast.error("Failed to access camera/microphone");
      }
    };

    setupPreview();

    return () => {
      if (localTrack?.video) {
        localTrack.video.stop();
      }
      if (localTrack?.audio) {
        localTrack.audio.stop();
      }
    };
  }, [isPreJoin]);

  const handleJoin = async () => {
    if (!consentGiven) {
      toast.error("Please provide consent to join the call");
      return;
    }

    if (!token || !roomName) {
      toast.error("Not ready to join");
      return;
    }

    try {
      const { connect, createLocalVideoTrack, createLocalAudioTrack } = await import("twilio-video");
      
      // Ensure local tracks are ready before connecting
      let videoTrack = localTrack?.video;
      let audioTrack = localTrack?.audio;
      
      if (!videoTrack || !audioTrack) {
        videoTrack = await createLocalVideoTrack();
        audioTrack = await createLocalAudioTrack();
        
        // Attach to local video element
        if (localVideoRef.current) {
          videoTrack.attach(localVideoRef.current);
        }
        
        setLocalTrack({ video: videoTrack, audio: audioTrack });
      }
      
      // Connect to room with tracks
      const twilioRoom = await connect(token, {
        name: roomName,
        tracks: [videoTrack, audioTrack],
      });
      
      setRoom(twilioRoom);
      setIsConnected(true);
      setIsPreJoin(false);

      // Handle remote participants (doctor)
      const handleParticipant = (participant: any) => {
        console.log("Handling participant:", participant.identity);
        
        // Subscribe to existing tracks
        participant.tracks.forEach((publication: any) => {
          if (publication.track) {
            console.log("Found existing track:", publication.track.kind);
            setRemoteTracks((prev) => {
              if (prev.includes(publication.track)) return prev;
              return [...prev, publication.track];
            });
            // Attach both video and audio tracks to the remote video element
            if (remoteVideoRef.current) {
              publication.track.attach(remoteVideoRef.current);
            }
          } else {
            // Subscribe to track when it becomes available
            publication.on("subscribed", (track: any) => {
              console.log("Track subscribed:", track.kind);
              setRemoteTracks((prev) => {
                if (prev.includes(track)) return prev;
                return [...prev, track];
              });
              // Attach both video and audio tracks
              if (remoteVideoRef.current) {
                track.attach(remoteVideoRef.current);
              }
            });
          }
        });

        // Listen for new tracks
        participant.on("trackSubscribed", (track: any) => {
          console.log("Track subscribed:", track.kind);
          setRemoteTracks((prev) => {
            if (prev.includes(track)) return prev;
            return [...prev, track];
          });
          // Attach both video and audio tracks
          if (remoteVideoRef.current) {
            track.attach(remoteVideoRef.current);
          }
        });

        participant.on("trackUnsubscribed", (track: any) => {
          console.log("Track unsubscribed:", track.kind);
          setRemoteTracks((prev) => prev.filter((t) => t !== track));
          track.detach();
        });
      };

      twilioRoom.on("participantConnected", handleParticipant);

      // Handle existing participants
      twilioRoom.participants.forEach(handleParticipant);
    } catch (error) {
      console.error("Error joining room:", error);
      toast.error("Failed to join call");
    }
  };

  // Reattach local video when ref becomes available
  React.useEffect(() => {
    if (localTrack?.video && localVideoRef.current && !isPreJoin) {
      console.log("Reattaching local video");
      localTrack.video.attach(localVideoRef.current);
    }
  }, [localTrack, isPreJoin]);

  // Reattach remote tracks (video and audio) when ref becomes available
  React.useEffect(() => {
    if (remoteVideoRef.current && remoteTracks.length > 0) {
      // Attach all remote tracks (both video and audio)
      remoteTracks.forEach((track) => {
        console.log("Reattaching remote track:", track.kind);
        track.attach(remoteVideoRef.current);
      });
    }
  }, [remoteTracks]);

  const toggleMute = () => {
    if (localTrack?.audio) {
      if (isMuted) {
        localTrack.audio.enable();
      } else {
        localTrack.audio.disable();
      }
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localTrack?.video) {
      if (isVideoOff) {
        localTrack.video.enable();
      } else {
        localTrack.video.disable();
      }
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleEndCall = () => {
    if (room) {
      room.disconnect();
    }
    if (localTrack?.video) {
      localTrack.video.stop();
    }
    if (localTrack?.audio) {
      localTrack.audio.stop();
    }
    window.close();
  };

  if (isPreJoin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Pre-Join Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Video Preview */}
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <Button
                variant={isMuted ? "destructive" : "outline"}
                size="icon"
                onClick={toggleMute}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Button
                variant={isVideoOff ? "destructive" : "outline"}
                size="icon"
                onClick={toggleVideo}
              >
                {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </Button>
            </div>

            {/* Consent */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">
                  I consent to this video call being recorded for medical documentation purposes.
                </span>
              </label>
            </div>

            {/* Join Button */}
            <Button
              onClick={handleJoin}
              disabled={!consentGiven || !token}
              className="w-full"
              size="lg"
            >
              Join Call
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-black">
      {/* Video Grid */}
      <div className="flex-1 relative">
        {/* Remote Video (Doctor) */}
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          {remoteTracks.some(t => t.kind === "video") ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-white text-center">
              <p className="text-lg">Please wait, your doctor will join shortly...</p>
            </div>
          )}
        </div>

        {/* Local Video (Self View) */}
        {localTrack?.video && (
          <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden border-2 border-white shadow-lg bg-black z-10">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="bg-background border-t p-4 flex items-center justify-center gap-4">
        <Button
          variant={isMuted ? "destructive" : "outline"}
          size="icon"
          onClick={toggleMute}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <Button
          variant={isVideoOff ? "destructive" : "outline"}
          size="icon"
          onClick={toggleVideo}
        >
          {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </Button>
        <Button
          variant="destructive"
          size="icon"
          onClick={handleEndCall}
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

