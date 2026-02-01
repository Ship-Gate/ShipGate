domain Messaging "Real-time messaging system" {
  
  type User {
    id: string
    username: string
    displayName: string
    status: string
    lastSeen: string
  }
  
  type Channel {
    id: string
    name: string
    type: string
    members: string[]
    createdAt: string
    createdBy: string
  }
  
  type Message {
    id: string
    channelId: string
    authorId: string
    content: string
    createdAt: string
    editedAt?: string
    replyTo?: string
    attachments: string[]
  }
  
  type Reaction {
    messageId: string
    userId: string
    emoji: string
    createdAt: string
  }
  
  behavior SendMessage "Send a message to a channel" (
    channelId: string,
    authorId: string,
    content: string,
    replyTo?: string
  ) returns Message {
    pre channel_exists: Channel with id == channelId exists
    pre author_is_member: authorId in channel.members
    pre content_not_empty: content.trim().length > 0
    pre content_not_too_long: content.length <= 4000
    pre reply_exists: replyTo is null or Message with id == replyTo exists
    
    post message_created: Message with channelId == channelId and authorId == authorId exists
    post members_notified: all members except authorId receive notification
    post unread_count_updated: unread_count for channel increased for other members
    post timestamp_set: message.createdAt == now()
  }
  
  behavior EditMessage "Edit an existing message" (
    messageId: string,
    userId: string,
    newContent: string
  ) returns Message {
    pre message_exists: Message with id == messageId exists
    pre is_author: message.authorId == userId
    pre within_edit_window: now() - message.createdAt < 24.hours
    pre content_valid: newContent.trim().length > 0 and newContent.length <= 4000
    
    post content_updated: message.content == newContent
    post edit_timestamp: message.editedAt == now()
    post edit_history_saved: MessageEdit with messageId == messageId created
  }
  
  behavior DeleteMessage "Delete a message" (
    messageId: string,
    userId: string
  ) {
    pre message_exists: Message with id == messageId exists
    pre has_permission: message.authorId == userId or user_is_admin(userId)
    
    post message_deleted: Message with id == messageId not exists
    post reactions_deleted: Reaction with messageId == messageId not exists
    post replies_orphaned: messages with replyTo == messageId have replyTo set to null
  }
  
  behavior CreateChannel "Create a new channel" (
    name: string,
    type: string,
    creatorId: string,
    initialMembers: string[]
  ) returns Channel {
    pre name_valid: name.length >= 2 and name.length <= 100
    pre type_valid: type in ["public", "private", "direct"]
    pre creator_exists: User with id == creatorId exists
    pre members_exist: all users in initialMembers exist
    pre direct_has_two: type != "direct" or initialMembers.length == 2
    
    post channel_created: Channel with name == name exists
    post creator_is_member: creatorId in channel.members
    post all_members_added: all initialMembers in channel.members
    post welcome_message: Message with content == "Channel created" exists
  }
  
  behavior AddReaction "Add a reaction to a message" (
    messageId: string,
    userId: string,
    emoji: string
  ) returns Reaction {
    pre message_exists: Message with id == messageId exists
    pre user_is_member: userId in channel.members where channel.id == message.channelId
    pre emoji_valid: emoji is valid_emoji
    pre not_duplicate: Reaction with messageId == messageId and userId == userId and emoji == emoji not exists
    
    post reaction_created: Reaction with messageId == messageId and userId == userId exists
    post author_notified: if message.authorId != userId then notification_sent
  }
}
