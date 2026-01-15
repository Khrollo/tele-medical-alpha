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
  const remoteAudioRef = React.useRef<HTMLAudioElement>(null);

  // Refs to track current values for cleanup
  const roomRef = React.useRef<any>(null);
  const localTrackRef = React.useRef<any>(null);
  const remoteTracksRef = React.useRef<any[]>([]);

  // Keep refs in sync with state
  React.useEffect(() => {
    roomRef.current = room;
  }, [room]);

  React.useEffect(() => {
    localTrackRef.current = localTrack;
  }, [localTrack]);

  React.useEffect(() => {
    remoteTracksRef.current = remoteTracks;
  }, [remoteTracks]);

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
        // Ensure video plays
        if (localVideoRef.current) {
          localVideoRef.current.play().catch(() => {
            // Ignore play errors
          });
        }
      } catch (error) {
        console.error("Error setting up preview:", error);
        toast.error("Failed to access camera/microphone");
      }
    };

    setupPreview();

    return () => {
      // ✅ DO NOT stop tracks here (it breaks the join transition)
      // If you want, you can detach preview element:
      try {
        localTrackRef.current?.video?.detach();
      } catch { }
      // Tracks will be properly stopped by cleanupTwilioConnection() on unmount/disconnect
    };
  }, [isPreJoin]);

  // Cleanup function for Twilio connection
  const cleanupTwilioConnection = React.useCallback(() => {
    // Disconnect from room
    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch (error) {
        console.error("Error disconnecting room:", error);
      }
      roomRef.current = null;
    }

    // Detach and stop local tracks
    if (localTrackRef.current) {
      try {
        if (localTrackRef.current.video) {
          localTrackRef.current.video.detach();
          localTrackRef.current.video.stop();
        }
        if (localTrackRef.current.audio) {
          localTrackRef.current.audio.detach();
          localTrackRef.current.audio.stop();
        }
      } catch (error) {
        console.error("Error stopping local tracks:", error);
      }
      localTrackRef.current = null;
    }

    // Detach and stop remote tracks
    remoteTracksRef.current.forEach((track) => {
      try {
        track.detach();
        if (track.stop) {
          track.stop();
        }
      } catch (error) {
        console.error("Error stopping remote track:", error);
      }
    });
    remoteTracksRef.current = [];

    // Clear video/audio element sources
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, []);

  // Cleanup on component unmount
  React.useEffect(() => {
    return () => {
      cleanupTwilioConnection();
    };
  }, [cleanupTwilioConnection]);

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

      // If we have existing tracks from pre-join, reuse them
      // Otherwise create new ones
      if (!videoTrack || !audioTrack) {
        videoTrack = await createLocalVideoTrack();
        audioTrack = await createLocalAudioTrack();
        setLocalTrack({ video: videoTrack, audio: audioTrack });
      }

      // Detach from pre-join element before connecting (if attached)
      // Use detach() which returns elements it was attached to
      try {
        const detachedEls = videoTrack.detach();
        if (detachedEls && detachedEls.length > 0) {
          console.log("Detached video track from pre-join element before connecting");
        }
      } catch (error) {
        // Track might not be attached, that's fine
      }

      // Ensure tracks are enabled before connecting
      if (!videoTrack.isEnabled) {
        videoTrack.enable();
      }
      if (!audioTrack.isEnabled) {
        audioTrack.enable();
      }

      // Debug: Check track state before connecting
      console.log("Tracks before connect:", {
        videoEnabled: videoTrack.isEnabled,
        audioEnabled: audioTrack.isEnabled,
        videoState: videoTrack.readyState,
        audioState: audioTrack.readyState,
        hasMediaStreamTrack: !!videoTrack.mediaStreamTrack,
        videoReadyState: videoTrack.mediaStreamTrack?.readyState
      });

      // Critical check: if track is ended, it was stopped
      if (videoTrack.mediaStreamTrack?.readyState === "ended") {
        console.error("❌ Video track is ENDED - it was stopped!");
        toast.error("Video track was stopped. Please refresh and try again.");
        return;
      }

      // Connect to room with tracks
      const twilioRoom = await connect(token, {
        name: roomName,
        tracks: [videoTrack, audioTrack],
      });

      console.log("Connected to room, local publications:", twilioRoom.localParticipant.tracks.size);

      // Debug: Confirm video was actually published
      const publishedVideoTracks = [...twilioRoom.localParticipant.videoTracks.values()];
      console.log("Published video tracks:", publishedVideoTracks.length);
      if (publishedVideoTracks.length === 0) {
        console.error("❌ No video tracks published!");
      }

      // Set room and connection state first
      setRoom(twilioRoom);
      setIsConnected(true);
      
      // Ensure local tracks are set BEFORE changing isPreJoin
      // This ensures the useEffect for attaching video runs with the correct state
      setLocalTrack({ video: videoTrack, audio: audioTrack });
      
      // Change isPreJoin last so the video attachment useEffect has all the data it needs
      setIsPreJoin(false);

      // Handle remote participants (doctor) - clean pattern using trackSubscribed only
      const handleParticipant = (participant: any) => {
        console.log("Handling participant:", participant.identity);

        // Handle already subscribed tracks
        participant.tracks.forEach((pub: any) => {
          if (pub.isSubscribed && pub.track) {
            const track = pub.track;
            setRemoteTracks((prev) => {
              if (prev.includes(track)) return prev;
              return [...prev, track];
            });

            // Attach to appropriate element based on track kind
            if (track.kind === "video" && remoteVideoRef.current) {
              track.attach(remoteVideoRef.current);
            } else if (track.kind === "audio" && remoteAudioRef.current) {
              track.attach(remoteAudioRef.current);
            }
          }
        });

        // Listen for new tracks being subscribed
        participant.on("trackSubscribed", (track: any) => {
          console.log("Track subscribed:", track.kind);
          setRemoteTracks((prev) => {
            if (prev.includes(track)) return prev;
            return [...prev, track];
          });

          // Attach to appropriate element based on track kind
          if (track.kind === "video" && remoteVideoRef.current) {
            track.attach(remoteVideoRef.current);
          } else if (track.kind === "audio" && remoteAudioRef.current) {
            track.attach(remoteAudioRef.current);
          }
        });

        participant.on("trackUnsubscribed", (track: any) => {
          console.log("Track unsubscribed:", track.kind);
          setRemoteTracks((prev) => prev.filter((t) => t !== track));
          track.detach();
        });
      };

      twilioRoom.on("participantConnected", handleParticipant);

      twilioRoom.on("participantDisconnected", (participant: any) => {
        console.log("Participant disconnected:", participant.identity);
        // Clear remote tracks when participant disconnects
        setRemoteTracks([]);
      });

      // Cleanup on room disconnect
      twilioRoom.on("disconnected", () => {
        cleanupTwilioConnection();
      });

      // Handle existing participants
      twilioRoom.participants.forEach(handleParticipant);
    } catch (error) {
      console.error("Error joining room:", error);
      toast.error("Failed to join call");
    }
  };

  // Attach local video track when transitioning to call view
  // Simple, reliable approach: detach from all, attach to new element
  React.useEffect(() => {
    if (isPreJoin || !isConnected) return;
    const videoEl = localVideoRef.current;
    const vTrack = localTrack?.video;
    if (!videoEl || !vTrack) {
      console.warn("Cannot attach local video - missing element or track", {
        hasElement: !!videoEl,
        hasTrack: !!vTrack,
        isPreJoin,
        isConnected,
      });
      return;
    }

    console.log("Attaching local video track to call view element", {
      trackEnabled: vTrack.isEnabled,
      trackState: vTrack.readyState,
    });

    // Detach from any previous elements, then attach once
    try {
      const detachedEls = vTrack.detach();
      if (detachedEls && detachedEls.length > 0) {
        console.log("Detached from previous elements:", detachedEls.length);
      }

      // Ensure track is enabled before attaching
      if (!vTrack.isEnabled) {
        vTrack.enable();
      }

      // Attach to new element
      vTrack.attach(videoEl);
      console.log("Attached to call view element");

      // Ensure it plays
      videoEl.play().catch((error) => {
        console.warn("Error playing local video:", error);
      });
    } catch (error) {
      console.error("Error attaching local video:", error);
    }

    return () => {
      try {
        if (videoEl && vTrack) {
          vTrack.detach(videoEl);
        }
      } catch (error) {
        console.warn("Error detaching local video:", error);
      }
    };
  }, [isPreJoin, isConnected, localTrack?.video]);

  // Reattach remote tracks when refs become available
  React.useEffect(() => {
    remoteTracks.forEach((track) => {
      try {
        if (track.kind === "video" && remoteVideoRef.current) {
          track.attach(remoteVideoRef.current);
        } else if (track.kind === "audio" && remoteAudioRef.current) {
          track.attach(remoteAudioRef.current);
        }
      } catch (error) {
        console.error("Error reattaching remote track:", error);
      }
    });
  }, [remoteTracks]);

  const toggleMute = () => {
    console.log("Toggle mute called", { isMuted, hasAudioTrack: !!localTrack?.audio, hasRoom: !!room });
    
    // Try to get audio track from localTrack state first, then from room
    let audioTrack: any = localTrack?.audio;
    if (!audioTrack && room?.localParticipant) {
      // Fallback: get audio track from room's local participant
      const audioPublications = Array.from(room.localParticipant.audioTracks.values());
      if (audioPublications.length > 0) {
        const pub = audioPublications[0] as any;
        if (pub?.track) {
          audioTrack = pub.track;
          console.log("Using audio track from room localParticipant");
        }
      }
    }
    
    if (audioTrack) {
      try {
        if (isMuted) {
          audioTrack.enable();
          console.log("Audio enabled");
        } else {
          audioTrack.disable();
          console.log("Audio disabled");
        }
        setIsMuted(!isMuted);
      } catch (error) {
        console.error("Error toggling mute:", error);
        toast.error("Failed to toggle microphone");
      }
    } else {
      console.warn("No audio track available to toggle");
      toast.error("Microphone not available");
    }
  };

  const toggleVideo = () => {
    console.log("Toggle video called", { isVideoOff, hasVideoTrack: !!localTrack?.video, hasRoom: !!room });
    
    // Try to get video track from localTrack state first, then from room
    let videoTrack: any = localTrack?.video;
    if (!videoTrack && room?.localParticipant) {
      // Fallback: get video track from room's local participant
      const videoPublications = Array.from(room.localParticipant.videoTracks.values()) as any[];
      if (videoPublications.length > 0) {
        const pub = videoPublications[0];
        if (pub?.track) {
          videoTrack = pub.track;
          console.log("Using video track from room localParticipant");
          // Update state with the track we found
          if (localTrack) {
            setLocalTrack({ ...localTrack, video: videoTrack });
          } else {
            setLocalTrack({ video: videoTrack, audio: null });
          }
        }
      }
    }
    
    if (videoTrack) {
      try {
        if (isVideoOff) {
          videoTrack.enable();
          console.log("Video enabled");
          // Reattach when enabling - detach first, then attach
          if (localVideoRef.current) {
            try {
              videoTrack.detach();
              videoTrack.attach(localVideoRef.current);
              localVideoRef.current.play().catch((error) => {
                console.warn("Error playing video after enable:", error);
              });
            } catch (error) {
              console.error("Error reattaching video:", error);
              toast.error("Failed to show video");
            }
          }
        } else {
          videoTrack.disable();
          console.log("Video disabled");
        }
        setIsVideoOff(!isVideoOff);
      } catch (error) {
        console.error("Error toggling video:", error);
        toast.error("Failed to toggle camera");
      }
    } else {
      console.warn("No video track available to toggle");
      toast.error("Camera not available");
    }
  };

  const handleEndCall = () => {
    console.log("End call called");
    try {
      cleanupTwilioConnection();
      setIsConnected(false);
      toast.success("Call ended");
      // Try to close window, but if it fails (e.g., window wasn't opened by script), just navigate away
      setTimeout(() => {
        try {
          window.close();
        } catch (error) {
          // If window.close() fails, redirect to a safe page
          window.location.href = "/";
        }
      }, 500);
    } catch (error) {
      console.error("Error ending call:", error);
      toast.error("Failed to end call properly");
      // Still try to navigate away
      window.location.href = "/";
    }
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
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
          {/* Remote Audio (Doctor) - separate element */}
          <audio
            ref={remoteAudioRef}
            autoPlay
            playsInline
          />
          {!remoteTracks.some(t => t.kind === "video") && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-center pointer-events-none">
              <p className="text-lg">Please wait, your doctor will join shortly...</p>
            </div>
          )}
        </div>

        {/* Local Video (Self View) */}
        <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden border-2 border-white shadow-lg bg-black z-10">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ 
              backgroundColor: 'black',
              display: localTrack?.video && !isVideoOff ? 'block' : 'none'
            }}
          />
          {(!localTrack?.video || isVideoOff) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black text-white text-xs">
              {isVideoOff ? "Camera off" : "Camera not available"}
            </div>
          )}
        </div>

        {/* Hidden audio element for local audio track */}
        {localTrack?.audio && (
          <audio
            ref={(el) => {
              if (el && localTrack?.audio) {
                try {
                  localTrack.audio.attach(el);
                  el.play().catch(() => {
                    // Ignore play errors
                  });
                } catch (error) {
                  console.error("Error attaching local audio:", error);
                }
              }
            }}
            autoPlay
            playsInline
          />
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

