import { useEffect, useState, useCallback } from 'react';
import { getUserId, listGroups, joinGroup, leaveGroup, listGroupMembers } from '../api';
import { genreLabel } from '../constants/genres';

export default function GroupsPanel({ user, readOnly = false, onOpen }) {
  const myId = getUserId(user);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyGenre, setBusyGenre] = useState(null);
  const [openGenre, setOpenGenre] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { groups: list } = await listGroups(myId);
      setGroups(list);
    } catch (e) {
      setError(e.message);
    }
  }, [myId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { groups: list } = await listGroups(myId);
        if (!cancelled) setGroups(list);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [myId]);

  const onJoin = async (genre) => {
    setBusyGenre(genre);
    try {
      await joinGroup(myId, genre);
      await refresh();
      if (onOpen) onOpen(genre);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyGenre(null);
    }
  };

  const onLeave = async (genre) => {
    setBusyGenre(genre);
    try {
      await leaveGroup(myId, genre);
      if (openGenre === genre) setOpenGenre(null);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyGenre(null);
    }
  };

  if (loading) return <div className="empty-state">Loading groups…</div>;
  if (error) return <div className="empty-state error">{error}</div>;

  const visible = readOnly ? groups.filter((g) => g.canView) : groups;

  if (readOnly && !visible.length) {
    return (
      <div className="empty-state">
        Reader groups will appear here for each genre you've published a book in.
      </div>
    );
  }

  return (
    <div className="groups-grid">
      {visible.map((g) => (
        <GroupCard
          key={g.genre}
          group={g}
          myId={myId}
          readOnly={readOnly}
          busy={busyGenre === g.genre}
          isOpen={openGenre === g.genre}
          onToggle={() => setOpenGenre(openGenre === g.genre ? null : g.genre)}
          onJoin={() => onJoin(g.genre)}
          onLeave={() => onLeave(g.genre)}
          onOpenChat={onOpen ? () => onOpen(g.genre) : null}
        />
      ))}
    </div>
  );
}

function GroupCard({ group, myId, readOnly, busy, isOpen, onToggle, onJoin, onLeave, onOpenChat }) {
  const [members, setMembers] = useState(null);
  const [memError, setMemError] = useState(null);
  const canViewMembers = readOnly ? group.canView : group.isMember;

  useEffect(() => {
    if (!isOpen || !canViewMembers) { setMembers(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { members: list } = await listGroupMembers(myId, group.genre);
        if (!cancelled) setMembers(list);
      } catch (e) {
        if (!cancelled) setMemError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, canViewMembers, myId, group.genre]);

  const soloMessage = group.isMember && group.memberCount === 1
    ? "You're the only one here — stay put till your tribe is found."
    : null;

  return (
    <div className={`group-card ${group.isMember ? 'group-joined' : ''}`}>
      <div className="group-card-header">
        <h4 className="group-card-title">{genreLabel(group.genre)}</h4>
        <span className="group-card-count">{group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}</span>
      </div>
      {!readOnly && (
        <div className="group-card-actions">
          {group.isMember ? (
            <>
              {onOpenChat && (
                <button className="btn-primary btn-sm" onClick={onOpenChat}>
                  💬 Open chat
                </button>
              )}
              <button className="btn-ghost btn-sm" onClick={onLeave} disabled={busy}>
                {busy ? 'Leaving…' : 'Leave'}
              </button>
            </>
          ) : (
            <button className="btn-primary btn-sm" onClick={onJoin} disabled={busy}>
              {busy ? 'Joining…' : 'Join'}
            </button>
          )}
        </div>
      )}
      {readOnly && group.canView && (
        <button className="btn-ghost btn-sm" onClick={onToggle}>
          {isOpen ? 'Hide members' : 'View members'}
        </button>
      )}
      {soloMessage && <p className="group-solo">{soloMessage}</p>}
      {isOpen && canViewMembers && (
        <div className="group-members">
          {memError && <p className="error">{memError}</p>}
          {members === null && !memError && <p className="muted">Loading…</p>}
          {members && members.length === 0 && <p className="muted">No members yet.</p>}
          {members && members.map((m) => (
            <div key={m.userId} className="group-member-row">
              <span className="group-member-name">{m.name || m.email || m.userId}</span>
              {m.ageGroup && <span className="group-member-meta">{m.ageGroup.replace('_', ' ')}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
