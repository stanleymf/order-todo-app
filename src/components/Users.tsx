import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Badge } from "./ui/badge"
import { Alert, AlertDescription } from "./ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "./ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"
import {
  Users as UsersIcon,
  Edit,
  Trash2,
  UserPlus,
  Shield,
  User,
  Mail,
  Calendar,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import { useIsMobile } from "./hooks/use-mobile"
import { getUsers, createUser, updateUser, deleteUser } from "../services/api"
import type { User as UserType } from "../types"
import { toast } from "sonner"

const userRoles = ["admin", "florist"] as const
type UserRole = (typeof userRoles)[number]

type NewUser = {
  name: string
  email: string
  password: string
  role: UserRole
}

type EditUser = {
  id: string
  name: string
  email: string
  role: UserRole
}

export const Users: React.FC = () => {
  const { user: currentUser, tenant } = useAuth()
  const isMobile = useIsMobile()
  
  const [users, setUsers] = useState<UserType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<EditUser | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  const [newUser, setNewUser] = useState<NewUser>({
    name: "",
    email: "",
    password: "",
    role: "florist",
  })

  const fetchUsers = async () => {
    if (!tenant?.id) return
    
    try {
      setIsLoading(true)
      const fetchedUsers = await getUsers(tenant.id)
      setUsers(fetchedUsers)
    } catch (error) {
      console.error("Failed to fetch users:", error)
      toast.error("Failed to load users")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [tenant?.id])

  const handleCreateUser = async () => {
    if (!tenant?.id) return
    
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      setIsSubmitting(true)
      await createUser(tenant.id, {
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
      })
      
      toast.success("User created successfully")
      setIsCreateDialogOpen(false)
      setNewUser({ name: "", email: "", password: "", role: "florist" })
      fetchUsers()
    } catch (error) {
      console.error("Failed to create user:", error)
      toast.error("Failed to create user")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateUser = async () => {
    if (!tenant?.id || !editingUser) return
    
    if (!editingUser.name || !editingUser.email) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      setIsSubmitting(true)
      await updateUser(tenant.id, editingUser.id, {
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role,
      })
      
      toast.success("User updated successfully")
      setIsEditDialogOpen(false)
      setEditingUser(null)
      fetchUsers()
    } catch (error) {
      console.error("Failed to update user:", error)
      toast.error("Failed to update user")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!tenant?.id) return
    
    if (userId === currentUser?.id) {
      toast.error("You cannot delete your own account")
      return
    }

    if (!confirm(`Are you sure you want to delete ${userName}?`)) {
      return
    }

    try {
      await deleteUser(tenant.id, userId)
      toast.success("User deleted successfully")
      fetchUsers()
    } catch (error) {
      console.error("Failed to delete user:", error)
      toast.error("Failed to delete user")
    }
  }

  const openEditDialog = (user: UserType) => {
    setEditingUser({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
    })
    setIsEditDialogOpen(true)
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive"
      case "florist":
        return "default"
      default:
        return "secondary"
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="h-4 w-4" />
      case "florist":
        return <User className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className={isMobile ? "pb-3" : ""}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className={isMobile ? "text-lg" : ""}>User Management</CardTitle>
              <CardDescription className={isMobile ? "text-sm" : ""}>
                Manage users and their roles within your organization.
              </CardDescription>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size={isMobile ? "sm" : "default"}>
                  <UserPlus className={`mr-2 ${isMobile ? "h-3 w-3" : "h-4 w-4"}`} />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className={isMobile ? "w-[95vw] max-w-[95vw]" : ""}>
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                  <DialogDescription>
                    Create a new user account with appropriate role and permissions.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="newUserName">Full Name</Label>
                    <Input
                      id="newUserName"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="newUserEmail">Email</Label>
                    <Input
                      id="newUserEmail"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="newUserPassword">Password</Label>
                    <div className="relative">
                      <Input
                        id="newUserPassword"
                        type={showPassword ? "text" : "password"}
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        placeholder="Enter password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="newUserRole">Role</Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(value: UserRole) => setNewUser({ ...newUser, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="florist">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Florist
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Admin
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateUser} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create User
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Users List */}
      <Card>
        <CardContent className={isMobile ? "p-4" : "p-6"}>
          {users.length === 0 ? (
            <Alert>
              <UsersIcon className="h-4 w-4" />
              <AlertDescription>
                No users found. Add your first user to get started.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {isMobile ? (
                // Mobile view - cards
                users.map((user) => (
                  <Card key={user.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getRoleIcon(user.role)}
                            <span className="font-semibold">{user.name}</span>
                            <Badge variant={getRoleBadgeVariant(user.role)}>
                              {user.role}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Calendar className="h-3 w-3" />
                            Joined {new Date(user.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 ml-4">
                          {user.id !== currentUser?.id && (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditDialog(user)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDeleteUser(user.id, user.name)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          {user.id === currentUser?.id && (
                            <Badge variant="outline" className="text-xs">
                              Current User
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                // Desktop view - table
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getRoleIcon(user.role)}
                            <span className="font-medium">{user.name}</span>
                            {user.id === currentUser?.id && (
                              <Badge variant="outline" className="text-xs">
                                You
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {user.id !== currentUser?.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => openEditDialog(user)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => handleDeleteUser(user.id, user.name)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">No actions</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className={isMobile ? "w-[95vw] max-w-[95vw]" : ""}>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and role.
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="editUserName">Full Name</Label>
                <Input
                  id="editUserName"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="editUserEmail">Email</Label>
                <Input
                  id="editUserEmail"
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <Label htmlFor="editUserRole">Role</Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(value: UserRole) => setEditingUser({ ...editingUser, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="florist">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Florist
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Admin
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
