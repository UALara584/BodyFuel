from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Friendship, User
from ..schemas import (
    FriendInvitationItem,
    FriendUser,
    FriendshipCreate,
    FriendshipListResponse,
    FriendshipRespond,
)

router = APIRouter(prefix="/friends", tags=["Friends"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_friendship_between_users(db: Session, user_a: int, user_b: int) -> Friendship | None:
    return (
        db.query(Friendship)
        .filter(
            ((Friendship.requester_id == user_a) & (Friendship.addressee_id == user_b))
            | ((Friendship.requester_id == user_b) & (Friendship.addressee_id == user_a))
        )
        .first()
    )


@router.get("/{user_id}", response_model=FriendshipListResponse)
def list_friends(user_id: int, db: Annotated[Session, Depends(get_db)]):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    accepted_sent = (
        db.query(User)
        .join(Friendship, Friendship.addressee_id == User.id)
        .filter(Friendship.requester_id == user_id, Friendship.status == "accepted")
        .all()
    )
    accepted_received = (
        db.query(User)
        .join(Friendship, Friendship.requester_id == User.id)
        .filter(Friendship.addressee_id == user_id, Friendship.status == "accepted")
        .all()
    )
    incoming_rows = (
        db.query(Friendship, User)
        .join(User, Friendship.requester_id == User.id)
        .filter(Friendship.addressee_id == user_id, Friendship.status == "pending")
        .all()
    )
    outgoing_rows = (
        db.query(Friendship, User)
        .join(User, Friendship.addressee_id == User.id)
        .filter(Friendship.requester_id == user_id, Friendship.status == "pending")
        .all()
    )

    friends_by_id: dict[int, User] = {}
    for friend in accepted_sent + accepted_received:
        friends_by_id[friend.id] = friend

    return FriendshipListResponse(
        friends=[FriendUser.model_validate(friend) for friend in friends_by_id.values()],
        incoming=[
            FriendInvitationItem(
                invitation_id=invitation.id,
                user=FriendUser.model_validate(friend_user),
            )
            for invitation, friend_user in incoming_rows
        ],
        outgoing=[
            FriendInvitationItem(
                invitation_id=invitation.id,
                user=FriendUser.model_validate(friend_user),
            )
            for invitation, friend_user in outgoing_rows
        ],
    )


@router.get("/{user_id}/search", response_model=list[FriendUser])
def search_users_for_friends(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    q: str = Query(default="", min_length=1),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    query = q.strip()
    if not query:
        return []

    users = (
        db.query(User)
        .filter(
            User.id != user_id,
            (User.nombre.ilike(f"%{query}%")) | (User.email.ilike(f"%{query}%")),
        )
        .limit(15)
        .all()
    )

    excluded_ids: set[int] = set()
    for candidate in users:
        existing = _get_friendship_between_users(db, user_id, candidate.id)
        if existing:
            excluded_ids.add(candidate.id)

    return [FriendUser.model_validate(candidate) for candidate in users if candidate.id not in excluded_ids]


@router.post("/invitations")
def create_invitation(payload: FriendshipCreate, db: Annotated[Session, Depends(get_db)]):
    if payload.requester_id == payload.addressee_id:
        raise HTTPException(status_code=400, detail="No puedes invitarte a ti mismo")

    requester = db.query(User).filter(User.id == payload.requester_id).first()
    addressee = db.query(User).filter(User.id == payload.addressee_id).first()
    if not requester or not addressee:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    existing = _get_friendship_between_users(db, payload.requester_id, payload.addressee_id)
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una relación o invitación entre estos usuarios")

    friendship = Friendship(
        requester_id=payload.requester_id,
        addressee_id=payload.addressee_id,
        status="pending",
    )
    db.add(friendship)
    db.commit()
    db.refresh(friendship)

    return {"message": "Invitación enviada", "invitation_id": friendship.id}


@router.post("/invitations/{invitation_id}/respond")
def respond_invitation(
    invitation_id: int, payload: FriendshipRespond, db: Annotated[Session, Depends(get_db)]
):
    invitation = db.query(Friendship).filter(Friendship.id == invitation_id).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")

    if invitation.addressee_id != payload.user_id:
        raise HTTPException(status_code=403, detail="No puedes responder esta invitación")

    if invitation.status != "pending":
        raise HTTPException(status_code=400, detail="Esta invitación ya fue respondida")

    if payload.accept:
        invitation.status = "accepted"
        db.commit()
        return {"message": "Invitación aceptada"}

    db.delete(invitation)
    db.commit()
    return {"message": "Invitación rechazada"}
